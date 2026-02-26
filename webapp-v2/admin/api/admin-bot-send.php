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

$targetTgId = (int)($input['telegram_id'] ?? 0);
$text = trim($input['text'] ?? '');
if (!$targetTgId || !$text) jsonError('telegram_id and text required');

$ch = curl_init("https://api.telegram.org/bot" . BOT_TOKEN . "/sendMessage");
curl_setopt_array($ch, [CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>json_encode(['chat_id'=>$targetTgId,'text'=>$text,'parse_mode'=>'HTML']),
    CURLOPT_HTTPHEADER=>['Content-Type: application/json'], CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>10]);
$resp = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
$result = json_decode($resp, true);

if ($code === 200 && ($result['ok'] ?? false)) jsonResponse(['ok'=>true,'message'=>'Отправлено']);
else jsonError('Telegram API error: '.($result['description'] ?? 'Unknown'), 502);
