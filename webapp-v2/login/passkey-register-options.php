<?php
// =====================================================
// WebAuthn PassKey — Registration Options
// GET: ?token=xxx (must be authenticated)
// Returns: PublicKeyCredentialCreationOptions
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token)) jsonError('Token is required');

$session = validateSession($database, $token);
if (!$session) jsonError('Invalid or expired session', 401);

$userId = $session['user_id'];
if (!$userId) jsonError('User not found', 400);

$user = getUserById($database, $userId);
if (!$user) jsonError('User not found', 404);

$challenge = createChallenge($database, 'register', $userId);

$existingPasskeys = getUserPasskeys($database, $userId);
$excludeCredentials = [];
foreach ($existingPasskeys as $pk) {
    $item = ['type' => 'public-key', 'id' => $pk['credential_id']];
    if (!empty($pk['transports'])) {
        $item['transports'] = json_decode($pk['transports'], true) ?: [];
    }
    $excludeCredentials[] = $item;
}

$displayName = $user['display_name'] ?: ($user['telegram_first_name'] ?: ($user['gomafia_nickname'] ?: "User {$userId}"));

jsonResponse([
    'publicKey' => [
        'challenge' => $challenge,
        'rp' => [
            'id' => WEBAUTHN_RP_ID,
            'name' => WEBAUTHN_RP_NAME,
        ],
        'user' => [
            'id' => base64url_encode(strval($userId)),
            'name' => $user['telegram_username'] ?: ($user['gomafia_nickname'] ?: "user_{$userId}"),
            'displayName' => $displayName,
        ],
        'pubKeyCredParams' => [
            ['type' => 'public-key', 'alg' => -7],   // ES256
            ['type' => 'public-key', 'alg' => -257],  // RS256
        ],
        'timeout' => 120000,
        'excludeCredentials' => $excludeCredentials,
        'authenticatorSelection' => [
            'authenticatorAttachment' => 'platform',
            'residentKey' => 'required',
            'requireResidentKey' => true,
            'userVerification' => 'required',
        ],
        'attestation' => 'none',
    ],
]);
