<?php
require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token)) jsonError('Token required', 401);
$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) jsonError('Access denied', 403);

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0); if (!$id) jsonError('ID required');
    $database->delete('promo_activations', ['promo_id' => $id]);
    $database->delete('promo_codes', ['id' => $id]);
    jsonResponse(['ok' => true, 'message' => 'Промокод удалён']);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    $adminTgId = (int)$session['telegram_id'];

    if ($action === 'create') {
        $code = strtoupper(trim($input['code'] ?? ''));
        $features = $input['features'] ?? []; $durationDays = max(1, (int)($input['duration_days'] ?? 30));
        $maxUses = max(0, (int)($input['max_uses'] ?? 1));
        if (empty($code)) $code = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        if (empty($features)) jsonError('features required');
        if ($database->get('promo_codes', 'id', ['code' => $code])) jsonError('Промокод уже существует');
        $database->insert('promo_codes', [
            'code' => $code, 'features' => json_encode($features), 'duration_days' => $durationDays,
            'max_uses' => $maxUses, 'is_active' => 1, 'created_by' => 'admin:' . $adminTgId,
            'expires_at' => $input['expires_at'] ?? null,
        ]);
        jsonResponse(['ok' => true, 'id' => $database->id(), 'code' => $code, 'message' => "Промокод {$code} создан"]);
    }
    if ($action === 'toggle') {
        $id = (int)($input['id'] ?? 0); if (!$id) jsonError('ID required');
        $cur = $database->get('promo_codes', 'is_active', ['id' => $id]);
        $new = $cur ? 0 : 1;
        $database->update('promo_codes', ['is_active' => $new], ['id' => $id]);
        jsonResponse(['ok' => true, 'is_active' => $new]);
    }
    if ($action === 'update') {
        $id = (int)($input['id'] ?? 0); if (!$id) jsonError('ID required');
        $upd = [];
        if (isset($input['features'])) $upd['features'] = json_encode($input['features']);
        if (isset($input['duration_days'])) $upd['duration_days'] = max(1, (int)$input['duration_days']);
        if (isset($input['max_uses'])) $upd['max_uses'] = max(0, (int)$input['max_uses']);
        if (isset($input['is_active'])) $upd['is_active'] = $input['is_active'] ? 1 : 0;
        if (array_key_exists('expires_at', $input)) $upd['expires_at'] = $input['expires_at'];
        if (empty($upd)) jsonError('Nothing to update');
        $database->update('promo_codes', $upd, ['id' => $id]);
        jsonResponse(['ok' => true, 'message' => 'Обновлено']);
    }
    jsonError('Unknown action');
}

if (isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $promo = $database->get('promo_codes', '*', ['id' => $id]);
    if (!$promo) jsonError('Not found', 404);
    $promo['features_parsed'] = json_decode($promo['features'], true);
    $acts = $database->select('promo_activations(pa)', ['[>]auth_sessions(a)' => ['pa.telegram_id' => 'telegram_id']],
        ['pa.id', 'pa.telegram_id', 'pa.activated_at', 'a.telegram_username', 'a.telegram_first_name'],
        ['pa.promo_id' => $id, 'GROUP' => 'pa.id', 'ORDER' => ['pa.activated_at' => 'DESC']]);
    jsonResponse(['promo' => $promo, 'activations' => $acts]);
}

try {
    $filter = $_GET['filter'] ?? 'all';
    $page = max(1, (int)($_GET['page'] ?? 1)); $limit = 25; $offset = ($page - 1) * $limit;
    $where = [];
    if ($filter === 'active') $where['is_active'] = 1;
    if ($filter === 'inactive') $where['is_active'] = 0;
    $total = $database->count('promo_codes', $where ?: null);
    $where['ORDER'] = ['created_at' => 'DESC']; $where['LIMIT'] = [$offset, $limit];
    $promos = $database->select('promo_codes', '*', $where);
    foreach ($promos as &$p) $p['features_parsed'] = json_decode($p['features'], true);
    unset($p);
    jsonResponse(['promos'=>$promos,'total'=>$total,'page'=>$page,'totalPages'=>ceil($total/$limit),'features_list'=>SUBSCRIPTION_FEATURES]);
} catch (\Throwable $e) { jsonError('DB error: '.$e->getMessage(), 500); }
