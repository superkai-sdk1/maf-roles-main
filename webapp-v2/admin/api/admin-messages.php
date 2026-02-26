<?php
require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token)) jsonError('Token required', 401);
$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) jsonError('Access denied', 403);
$adminTgId = (int)$session['telegram_id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';

    if ($action === 'reply') {
        $tgId = (int)($input['telegram_id'] ?? 0); $text = trim($input['text'] ?? '');
        if (!$tgId || !$text) jsonError('telegram_id and text required');
        $database->insert('bot_messages', ['telegram_id'=>$tgId,'direction'=>'out','message_text'=>$text,'message_type'=>'text','admin_id'=>$adminTgId]);
        jsonResponse(['ok'=>true,'message_id'=>$database->id(),'send_via_bot'=>true,'telegram_id'=>$tgId,'text'=>$text]);
    }
    if ($action === 'mark_read') {
        $tgId = (int)($input['telegram_id'] ?? 0); if (!$tgId) jsonError('telegram_id required');
        $database->update('bot_messages', ['is_read'=>1], ['telegram_id'=>$tgId,'direction'=>'in','is_read'=>0]);
        jsonResponse(['ok'=>true]);
    }
    if ($action === 'confirm_payment') {
        $payId = (int)($input['payment_id'] ?? 0); if (!$payId) jsonError('payment_id required');
        $pay = $database->get('payment_requests', '*', ['id'=>$payId]);
        if (!$pay) jsonError('Not found',404); if ($pay['status']!=='pending') jsonError('Already processed');
        $feats = json_decode($pay['features'], true) ?: [$pay['features']];
        foreach ($feats as $f) grantSubscription($database, $pay['telegram_id'], $f, 30, 'payment:'.$payId, $pay['user_id']);
        $database->update('payment_requests', ['status'=>'confirmed','confirmed_at'=>date('Y-m-d H:i:s'),'confirmed_by'=>$adminTgId], ['id'=>$payId]);
        $names = array_map(fn($f)=>$f==='all'?'Полный доступ':(SUBSCRIPTION_FEATURES[$f]??$f), $feats);
        $msg = "Оплата подтверждена! Подписка активирована: ".implode(', ',$names)." на 30 дней.";
        $database->insert('bot_messages', ['telegram_id'=>$pay['telegram_id'],'direction'=>'out','message_text'=>$msg,'message_type'=>'payment_confirm','admin_id'=>$adminTgId]);
        jsonResponse(['ok'=>true,'message'=>'Оплата подтверждена','send_via_bot'=>true,'telegram_id'=>$pay['telegram_id'],'text'=>$msg]);
    }
    if ($action === 'reject_payment') {
        $payId = (int)($input['payment_id'] ?? 0); $note = trim($input['note'] ?? '');
        if (!$payId) jsonError('payment_id required');
        $pay = $database->get('payment_requests', '*', ['id'=>$payId]);
        if (!$pay) jsonError('Not found',404); if ($pay['status']!=='pending') jsonError('Already processed');
        $database->update('payment_requests', ['status'=>'rejected','admin_note'=>$note,'confirmed_at'=>date('Y-m-d H:i:s'),'confirmed_by'=>$adminTgId], ['id'=>$payId]);
        $msg = 'Заявка на оплату отклонена.'.($note?" Причина: {$note}":'');
        $database->insert('bot_messages', ['telegram_id'=>$pay['telegram_id'],'direction'=>'out','message_text'=>$msg,'message_type'=>'text','admin_id'=>$adminTgId]);
        jsonResponse(['ok'=>true,'message'=>'Отклонена','send_via_bot'=>true,'telegram_id'=>$pay['telegram_id'],'text'=>$msg]);
    }
    jsonError('Unknown action');
}

if (isset($_GET['telegram_id'])) {
    $tgId = (int)$_GET['telegram_id'];
    $msgs = $database->select('bot_messages', '*', ['telegram_id'=>$tgId,'ORDER'=>['created_at'=>'ASC'],'LIMIT'=>200]);
    $pays = $database->select('payment_requests', '*', ['telegram_id'=>$tgId,'ORDER'=>['created_at'=>'DESC']]);
    foreach ($pays as &$p) $p['features_parsed'] = json_decode($p['features'], true); unset($p);
    $ui = $database->get('auth_sessions', ['telegram_username','telegram_first_name','telegram_last_name'], ['telegram_id'=>$tgId,'ORDER'=>['last_active'=>'DESC']]);
    jsonResponse(['telegram_id'=>$tgId,'user'=>$ui,'messages'=>$msgs,'payments'=>$pays]);
}

try {
    $page = max(1,(int)($_GET['page']??1)); $limit=25; $off=($page-1)*$limit;
    $total = (int)$database->pdo->query("SELECT COUNT(DISTINCT telegram_id) FROM bot_messages")->fetchColumn();
    $sql = "SELECT m.telegram_id, MAX(a.telegram_username) as username, MAX(a.telegram_first_name) as first_name,
        MAX(a.telegram_last_name) as last_name, COUNT(m.id) as total_messages,
        SUM(CASE WHEN m.direction='in' AND m.is_read=0 THEN 1 ELSE 0 END) as unread_count,
        MAX(m.created_at) as last_message_at,
        (SELECT mm.message_text FROM bot_messages mm WHERE mm.telegram_id=m.telegram_id ORDER BY mm.created_at DESC LIMIT 1) as last_message
        FROM bot_messages m LEFT JOIN auth_sessions a ON a.telegram_id=m.telegram_id
        GROUP BY m.telegram_id ORDER BY last_message_at DESC LIMIT {$limit} OFFSET {$off}";
    $convs = $database->pdo->query($sql)->fetchAll(\PDO::FETCH_ASSOC);
    $pendPay = (int)$database->count('payment_requests', ['status'=>'pending']);
    jsonResponse(['conversations'=>$convs,'total'=>$total,'page'=>$page,'totalPages'=>ceil($total/$limit),'pending_payments'=>$pendPay]);
} catch (\Throwable $e) { jsonError('DB error: '.$e->getMessage(), 500); }
