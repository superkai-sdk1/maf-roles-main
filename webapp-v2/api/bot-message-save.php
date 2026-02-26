<?php
require_once __DIR__ . '/../login/auth-helpers.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('POST required', 405);

$input = json_decode(file_get_contents('php://input'), true);
$botSecret = isset($input['bot_secret']) ? $input['bot_secret'] : '';
$expectedSecret = hash('sha256', BOT_TOKEN);
if ($botSecret !== $expectedSecret) jsonError('Invalid bot_secret', 403);

$telegramId = isset($input['telegram_id']) ? (int)$input['telegram_id'] : 0;
if (!$telegramId) jsonError('telegram_id required');

if (isset($input['action']) && $input['action'] === 'activate_trial') {
    $user = $database->get('users', '*', ['telegram_id' => $telegramId]);
    $result = activateTrial($database, $telegramId, $user ? $user['id'] : null);
    jsonResponse(['ok' => $result, 'message' => $result ? 'Trial activated' : 'Trial already used']);
}

$direction = isset($input['direction']) ? $input['direction'] : 'in';
$messageText = isset($input['message_text']) ? trim($input['message_text']) : '';
$messageType = isset($input['message_type']) ? $input['message_type'] : 'text';
if (empty($messageText)) jsonError('message_text required');

$database->insert('bot_messages', [
    'telegram_id' => $telegramId, 'direction' => $direction,
    'message_text' => $messageText, 'message_type' => $messageType,
    'is_read' => $direction === 'out' ? 1 : 0,
]);

jsonResponse(['ok' => true, 'id' => $database->id()]);
