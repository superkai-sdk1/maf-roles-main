<?php
require_once __DIR__ . '/../login/auth-helpers.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('POST required', 405);

$input = json_decode(file_get_contents('php://input'), true);
$token = isset($input['token']) ? trim($input['token']) : '';
$features = isset($input['features']) ? $input['features'] : [];
$telegramIdDirect = isset($input['telegram_id']) ? (int)$input['telegram_id'] : 0;

if (empty($token)) jsonError('Token required', 401);
if (empty($features) || !is_array($features)) jsonError('Features required');

$telegramId = null; $userId = null;
if (strpos($token, 'bot_') === 0 && $telegramIdDirect) {
    $telegramId = $telegramIdDirect;
    $user = $database->get('users', '*', ['telegram_id' => $telegramId]);
    $userId = $user ? $user['id'] : null;
} else {
    $session = validateSession($database, $token);
    if (!$session) jsonError('Invalid or expired token', 401);
    $telegramId = $session['telegram_id']; $userId = $session['user_id'];
}
if (empty($telegramId)) jsonError('Telegram ID not linked', 400);

$validFeatures = [];
foreach ($features as $f) {
    if ($f === 'all' || isset(SUBSCRIPTION_FEATURES[$f])) $validFeatures[] = $f;
}
if (empty($validFeatures)) jsonError('No valid features selected');

$pending = $database->get('payment_requests', 'id', ['telegram_id' => $telegramId, 'status' => 'pending']);
if ($pending) jsonError('У вас уже есть ожидающая заявка на оплату.');

$amount = calculatePrice($validFeatures);
$database->insert('payment_requests', [
    'user_id' => $userId, 'telegram_id' => $telegramId,
    'features' => json_encode($validFeatures), 'amount' => $amount, 'status' => 'pending',
]);

jsonResponse(['success' => true, 'request_id' => $database->id(), 'amount' => $amount, 'features' => $validFeatures,
    'message' => "Заявка создана. Сумма: {$amount}₽."]);
