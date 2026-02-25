<?php
// =====================================================
// WebAuthn PassKey — Complete Authentication
// POST: {credentialId, authenticatorData, clientDataJSON, signature, userHandle}
// Returns: {token, user} on success
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) jsonError('Invalid JSON body');

$credentialId = $input['credentialId'] ?? '';
$authDataB64 = $input['authenticatorData'] ?? '';
$clientDataB64 = $input['clientDataJSON'] ?? '';
$signatureB64 = $input['signature'] ?? '';
$userHandleB64 = $input['userHandle'] ?? '';

if (empty($credentialId) || empty($authDataB64) || empty($clientDataB64) || empty($signatureB64)) {
    jsonError('Missing required fields');
}

// Find the passkey
$passkey = getPasskeyByCredentialId($database, $credentialId);
if (!$passkey) jsonError('Credential not found', 404);

// Decode clientDataJSON and verify
$clientDataJSON = base64url_decode($clientDataB64);
$clientData = json_decode($clientDataJSON, true);
if (!$clientData) jsonError('Invalid clientDataJSON');

if (($clientData['type'] ?? '') !== 'webauthn.get') {
    jsonError('Invalid ceremony type');
}

if (!validateAndConsumeChallenge($database, $clientData['challenge'] ?? '', 'authenticate')) {
    jsonError('Invalid or expired challenge', 403);
}

// Verify origin (allow localhost in dev)
$origin = $clientData['origin'] ?? '';
if ($origin !== WEBAUTHN_ORIGIN) {
    if (strpos($origin, 'localhost') === false && strpos($origin, '127.0.0.1') === false) {
        jsonError('Invalid origin');
    }
}

// Verify authenticatorData
$authData = base64url_decode($authDataB64);
if (strlen($authData) < 37) jsonError('Invalid authenticatorData');

$rpIdHash = substr($authData, 0, 32);
$expectedRpIdHash = hash('sha256', WEBAUTHN_RP_ID, true);
if (!hash_equals($expectedRpIdHash, $rpIdHash)) {
    jsonError('RP ID mismatch');
}

$flags = ord($authData[32]);
if (!($flags & 0x01)) {
    jsonError('User not present');
}

// Extract counter (bytes 33-36, big-endian uint32)
$counter = unpack('N', substr($authData, 33, 4))[1];

// Verify signature
$publicKeyDer = base64_decode($passkey['public_key']);
$pem = spkiToPem($publicKeyDer);
$signature = base64url_decode($signatureB64);

$valid = verifyWebAuthnSignature($authData, $clientDataJSON, $signature, $pem, (int)$passkey['algorithm']);
if (!$valid) {
    jsonError('Invalid signature', 403);
}

// Check and update counter (protection against cloned authenticators)
$storedCounter = (int)$passkey['counter'];
if ($storedCounter > 0 && $counter <= $storedCounter) {
    error_log("WebAuthn counter rollback detected for credential {$credentialId}");
}
$database->update($TABLE_USER_PASSKEYS, [
    'counter' => $counter,
    'last_used_at' => date('Y-m-d H:i:s'),
], [
    'id' => $passkey['id']
]);

// Create session
$userId = (int)$passkey['user_id'];
$token = createSession($database, $userId, 'passkey');

if (random_int(1, 100) === 1) {
    cleanupExpired($database);
}

$user = getUserById($database, $userId);
$userResponse = buildUserResponse($database, [
    'user_id' => $userId,
    'auth_method' => 'passkey',
    'telegram_id' => $user['telegram_id'] ?? null,
    'telegram_username' => $user['telegram_username'] ?? null,
    'telegram_first_name' => $user['telegram_first_name'] ?? null,
    'telegram_last_name' => $user['telegram_last_name'] ?? null,
]);

jsonResponse([
    'token' => $token,
    'user' => $userResponse,
]);
