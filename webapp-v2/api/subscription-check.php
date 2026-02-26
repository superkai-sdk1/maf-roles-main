<?php
require_once __DIR__ . '/../login/auth-helpers.php';
setJsonHeaders();

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
$telegramIdDirect = isset($_GET['telegram_id']) ? (int)$_GET['telegram_id'] : 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['action']) && $input['action'] === 'activate_trial' && isset($input['telegram_id'])) {
        $tgId = (int)$input['telegram_id'];
        $user = $database->get('users', '*', ['telegram_id' => $tgId]);
        $result = activateTrial($database, $tgId, $user ? $user['id'] : null);
        jsonResponse(['ok' => $result]);
    }
}

if (empty($token) && !$telegramIdDirect) jsonError('Token or telegram_id required', 401);

$telegramId = null;
if (strpos($token, 'bot_') === 0 && $telegramIdDirect) {
    $telegramId = $telegramIdDirect;
} else if ($token) {
    $session = validateSession($database, $token);
    if (!$session) jsonError('Invalid or expired token', 401);
    $telegramId = $session['telegram_id'];
}
if (empty($telegramId)) jsonError('Telegram ID not available', 400);

expireOldSubscriptions($database);
$subscriptions = getActiveSubscriptions($database, $telegramId);
$canTrial = canActivateTrial($database, $telegramId);

$allFeatures = [];
foreach (SUBSCRIPTION_FEATURES as $slug => $name) {
    $allFeatures[$slug] = [
        'name' => $name,
        'has_access' => isset($subscriptions[$slug]),
        'is_trial' => isset($subscriptions[$slug]) ? $subscriptions[$slug]['is_trial'] : false,
        'expires_at' => isset($subscriptions[$slug]) ? $subscriptions[$slug]['expires_at'] : null,
        'days_left' => isset($subscriptions[$slug]) ? $subscriptions[$slug]['days_left'] : 0,
    ];
}

jsonResponse([
    'subscriptions' => $allFeatures,
    'has_any_active' => !empty($subscriptions),
    'can_activate_trial' => $canTrial,
    'pricing' => ['per_feature' => PRICE_PER_FEATURE, 'all_features' => PRICE_ALL_FEATURES],
]);
