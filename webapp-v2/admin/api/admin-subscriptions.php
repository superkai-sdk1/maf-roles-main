<?php
require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token)) jsonError('Token required', 401);
$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) jsonError('Access denied', 403);

expireOldSubscriptions($database);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = isset($input['action']) ? $input['action'] : '';
    $targetTgId = isset($input['telegram_id']) ? (int)$input['telegram_id'] : 0;
    if (!$targetTgId) jsonError('telegram_id required');
    $adminTgId = (int)$session['telegram_id'];
    $targetUser = $database->get('users', '*', ['telegram_id' => $targetTgId]);
    $targetUserId = $targetUser ? $targetUser['id'] : null;

    switch ($action) {
        case 'grant':
            $feature = $input['feature'] ?? ''; $days = max(1, (int)($input['days'] ?? 30));
            if (!$feature || ($feature !== 'all' && !isset(SUBSCRIPTION_FEATURES[$feature]))) jsonError('Invalid feature');
            grantSubscription($database, $targetTgId, $feature, $days, 'admin:' . $adminTgId, $targetUserId);
            jsonResponse(['ok' => true, 'message' => "Подписка '{$feature}' выдана на {$days} дней"]);
        case 'grant_all':
            $days = max(1, (int)($input['days'] ?? 30));
            grantSubscription($database, $targetTgId, 'all', $days, 'admin:' . $adminTgId, $targetUserId);
            jsonResponse(['ok' => true, 'message' => "Полный доступ на {$days} дней"]);
        case 'revoke':
            $feature = $input['feature'] ?? ''; if (!$feature) jsonError('feature required');
            revokeSubscription($database, $targetTgId, $feature);
            jsonResponse(['ok' => true, 'message' => "Подписка '{$feature}' отключена"]);
        case 'revoke_all':
            foreach (array_keys(SUBSCRIPTION_FEATURES) as $f) revokeSubscription($database, $targetTgId, $f);
            revokeSubscription($database, $targetTgId, 'all');
            jsonResponse(['ok' => true, 'message' => 'Все подписки отключены']);
        case 'extend':
            $feature = $input['feature'] ?? ''; $days = max(1, (int)($input['days'] ?? 30));
            if (!$feature) jsonError('feature required');
            grantSubscription($database, $targetTgId, $feature, $days, 'admin:' . $adminTgId, $targetUserId);
            jsonResponse(['ok' => true, 'message' => "Продлено на {$days} дней"]);
        default: jsonError('Unknown action');
    }
}

if (isset($_GET['telegram_id'])) {
    $tgId = (int)$_GET['telegram_id'];
    $subs = $database->select('user_subscriptions', '*', ['telegram_id' => $tgId, 'ORDER' => ['created_at' => 'DESC']]);
    $userInfo = $database->get('auth_sessions', ['telegram_username', 'telegram_first_name', 'telegram_last_name'],
        ['telegram_id' => $tgId, 'ORDER' => ['last_active' => 'DESC']]);
    jsonResponse(['telegram_id' => $tgId, 'user' => $userInfo, 'active_features' => getActiveSubscriptions($database, $tgId),
        'can_trial' => canActivateTrial($database, $tgId), 'history' => $subs]);
}

if (isset($_GET['search_users'])) {
    $q = trim($_GET['search_users']);
    if (mb_strlen($q) < 2) jsonError('Минимум 2 символа для поиска');
    $like = "%{$q}%";
    $stmt = $database->pdo->prepare("
        SELECT u.id, u.telegram_id, u.telegram_username, u.telegram_first_name,
               u.telegram_last_name, u.display_name, u.created_at
        FROM users u
        WHERE u.telegram_id IS NOT NULL AND u.telegram_id > 0
          AND (u.telegram_username LIKE :q1
               OR u.telegram_first_name LIKE :q2
               OR u.telegram_last_name LIKE :q3
               OR u.display_name LIKE :q4
               OR CAST(u.telegram_id AS CHAR) LIKE :q5)
        ORDER BY u.updated_at DESC
        LIMIT 20
    ");
    $stmt->execute([':q1' => $like, ':q2' => $like, ':q3' => $like, ':q4' => $like, ':q5' => $like]);
    $users = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    foreach ($users as &$u) {
        $u['active_features'] = getActiveSubscriptions($database, (int)$u['telegram_id']);
    }
    unset($u);
    jsonResponse(['users' => $users]);
}

try {
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $filter = isset($_GET['filter']) ? $_GET['filter'] : 'all';
    $page = max(1, (int)($_GET['page'] ?? 1)); $limit = 25; $offset = ($page - 1) * $limit;
    $wh = ''; $params = [];
    if ($filter === 'active') $wh .= " AND s.status='active' AND s.expires_at>NOW()";
    elseif ($filter === 'expired') $wh .= " AND (s.status='expired' OR s.expires_at<=NOW())";
    elseif ($filter === 'trial') $wh .= " AND s.is_trial=1";
    if ($search) {
        $wh .= " AND (a.telegram_username LIKE :s1 OR a.telegram_first_name LIKE :s2 OR CAST(s.telegram_id AS CHAR) LIKE :s3)";
        $params = [':s1'=>"%{$search}%",':s2'=>"%{$search}%",':s3'=>"%{$search}%"];
    }
    $total = (int)$database->pdo->prepare($q="SELECT COUNT(DISTINCT s.telegram_id) FROM user_subscriptions s LEFT JOIN auth_sessions a ON a.telegram_id=s.telegram_id WHERE 1=1{$wh}")->execute($params) ? (int)$database->pdo->prepare($q)->execute($params) : 0;
    $stmtC = $database->pdo->prepare($q); $stmtC->execute($params); $total = (int)$stmtC->fetchColumn();
    $sql = "SELECT s.telegram_id, MAX(a.telegram_username) as username, MAX(a.telegram_first_name) as first_name,
        MAX(a.telegram_last_name) as last_name,
        COUNT(DISTINCT CASE WHEN s.status='active' AND s.expires_at>NOW() THEN s.feature END) as active_count,
        MAX(CASE WHEN s.is_trial=1 THEN 1 ELSE 0 END) as has_trial,
        MAX(s.expires_at) as latest_expiry, MAX(s.created_at) as latest_activity
        FROM user_subscriptions s LEFT JOIN auth_sessions a ON a.telegram_id=s.telegram_id
        WHERE 1=1{$wh} GROUP BY s.telegram_id ORDER BY latest_activity DESC LIMIT {$limit} OFFSET {$offset}";
    $stmt = $database->pdo->prepare($sql); $stmt->execute($params); $users = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    foreach ($users as &$u) $u['active_features'] = getActiveSubscriptions($database, $u['telegram_id']);
    unset($u);
    jsonResponse(['users'=>$users,'total'=>$total,'page'=>$page,'totalPages'=>ceil($total/$limit),'features_list'=>SUBSCRIPTION_FEATURES]);
} catch (\Throwable $e) { jsonError('DB error: '.$e->getMessage(), 500); }
