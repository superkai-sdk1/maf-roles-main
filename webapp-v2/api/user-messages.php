<?php
require_once __DIR__ . '/../login/auth-helpers.php';
setJsonHeaders();

$rawBody = file_get_contents('php://input');
$input = json_decode($rawBody, true) ?: [];

$token = '';
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = isset($_GET['token']) ? trim($_GET['token']) : '';
} else {
    $token = isset($input['token']) ? trim($input['token']) : '';
}

if (empty($token)) jsonError('Token required', 401);
$session = validateSession($database, $token);
if (!$session) jsonError('Invalid or expired token', 401);
$telegramId = $session['telegram_id'];
if (empty($telegramId)) jsonError('Telegram ID not linked', 400);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = 50;
    $offset = ($page - 1) * $limit;

    $messages = $database->select('bot_messages', '*', [
        'telegram_id' => $telegramId,
        'ORDER' => ['created_at' => 'ASC'],
        'LIMIT' => [$offset, $limit],
    ]);

    $total = $database->count('bot_messages', ['telegram_id' => $telegramId]);
    $unread = $database->count('bot_messages', [
        'telegram_id' => $telegramId,
        'direction' => 'out',
        'is_read' => 0,
    ]);

    jsonResponse([
        'messages' => $messages,
        'total' => $total,
        'unread' => $unread,
        'page' => $page,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $input['action'] ?? 'send';

    if ($action === 'send') {
        $text = trim($input['text'] ?? '');
        if (empty($text)) jsonError('Message text required');
        if (mb_strlen($text) > 2000) jsonError('Message too long (max 2000 chars)');

        $database->insert('bot_messages', [
            'telegram_id' => $telegramId,
            'direction' => 'in',
            'message_text' => $text,
            'message_type' => 'web_chat',
            'is_read' => 0,
        ]);

        jsonResponse(['ok' => true, 'id' => $database->id()]);
    }

    if ($action === 'mark_read') {
        $database->update('bot_messages', ['is_read' => 1], [
            'telegram_id' => $telegramId,
            'direction' => 'out',
            'is_read' => 0,
        ]);
        jsonResponse(['ok' => true]);
    }

    jsonError('Unknown action');
}

jsonError('Method not allowed', 405);
