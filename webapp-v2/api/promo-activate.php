<?php
require_once __DIR__ . '/../login/auth-helpers.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('POST required', 405);

$input = json_decode(file_get_contents('php://input'), true);
$token = isset($input['token']) ? trim($input['token']) : '';
$code = isset($input['code']) ? trim(strtoupper($input['code'])) : '';
$telegramIdDirect = isset($input['telegram_id']) ? (int)$input['telegram_id'] : 0;

if (empty($token)) jsonError('Token required', 401);
if (empty($code)) jsonError('Promo code required');

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

$promo = $database->get('promo_codes', '*', ['code' => $code]);
if (!$promo) jsonError('Промокод не найден', 404);
if (!$promo['is_active']) jsonError('Промокод деактивирован');
if ($promo['expires_at'] && strtotime($promo['expires_at']) < time()) jsonError('Промокод истёк');
if ($promo['max_uses'] > 0 && $promo['current_uses'] >= $promo['max_uses']) jsonError('Промокод использован максимальное количество раз');

$alreadyUsed = $database->get('promo_activations', 'id', ['promo_id' => $promo['id'], 'telegram_id' => $telegramId]);
if ($alreadyUsed) jsonError('Вы уже активировали этот промокод');

$features = json_decode($promo['features'], true);
if (!$features) $features = [$promo['features']];
$days = (int)$promo['duration_days'];

$granted = [];
foreach ($features as $f) {
    if ($f === 'all' || isset(SUBSCRIPTION_FEATURES[$f])) {
        grantSubscription($database, $telegramId, $f, $days, 'promo:' . $code, $userId);
        $granted[] = $f;
    }
}

$database->insert('promo_activations', ['promo_id' => $promo['id'], 'user_id' => $userId, 'telegram_id' => $telegramId]);
$database->update('promo_codes', ['current_uses[+]' => 1], ['id' => $promo['id']]);

jsonResponse([
    'success' => true, 'message' => 'Промокод активирован!',
    'granted_features' => $granted, 'duration_days' => $days,
    'subscriptions' => getActiveSubscriptions($database, $telegramId),
]);
