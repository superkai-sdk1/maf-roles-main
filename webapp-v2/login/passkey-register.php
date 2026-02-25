<?php
// =====================================================
// WebAuthn PassKey — Complete Registration
// POST: {token, credentialId, publicKey, publicKeyAlgorithm, authenticatorData, clientDataJSON, transports}
// Returns: {success: true, passkey_id}
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) jsonError('Invalid JSON body');

$token = $input['token'] ?? '';
if (empty($token)) jsonError('Token is required');

$session = validateSession($database, $token);
if (!$session) jsonError('Invalid or expired session', 401);

$userId = $session['user_id'];
if (!$userId) jsonError('User not found', 400);

$credentialId = $input['credentialId'] ?? '';
$publicKeyB64 = $input['publicKey'] ?? '';
$algorithm = intval($input['publicKeyAlgorithm'] ?? -7);
$authDataB64 = $input['authenticatorData'] ?? '';
$clientDataB64 = $input['clientDataJSON'] ?? '';
$transports = $input['transports'] ?? [];
$deviceName = $input['deviceName'] ?? null;

if (empty($credentialId) || empty($publicKeyB64) || empty($authDataB64) || empty($clientDataB64)) {
    jsonError('Missing required fields');
}

// Decode clientDataJSON and verify
$clientDataJSON = base64url_decode($clientDataB64);
$clientData = json_decode($clientDataJSON, true);
if (!$clientData) jsonError('Invalid clientDataJSON');

if (($clientData['type'] ?? '') !== 'webauthn.create') {
    jsonError('Invalid ceremony type');
}

if (!validateAndConsumeChallenge($database, $clientData['challenge'] ?? '', 'register')) {
    jsonError('Invalid or expired challenge', 403);
}

$expectedOrigin = WEBAUTHN_ORIGIN;
if (($clientData['origin'] ?? '') !== $expectedOrigin) {
    // Allow localhost variations in development
    $origin = $clientData['origin'] ?? '';
    if (strpos($origin, 'localhost') === false && strpos($origin, '127.0.0.1') === false) {
        jsonError('Invalid origin');
    }
}

// Verify RP ID hash in authenticatorData
$authData = base64url_decode($authDataB64);
if (strlen($authData) < 37) jsonError('Invalid authenticatorData');

$rpIdHash = substr($authData, 0, 32);
$expectedRpIdHash = hash('sha256', WEBAUTHN_RP_ID, true);
if (!hash_equals($expectedRpIdHash, $rpIdHash)) {
    jsonError('RP ID mismatch');
}

// Check flags: bit 0 = user present, bit 2 = user verified (optional)
$flags = ord($authData[32]);
if (!($flags & 0x01)) {
    jsonError('User not present');
}

// Decode the public key (SPKI DER format from getPublicKey())
$publicKeyDer = base64_decode($publicKeyB64);
if (!$publicKeyDer) jsonError('Invalid public key');

// Verify the key is valid by trying to load it
$pem = spkiToPem($publicKeyDer);
$keyResource = openssl_pkey_get_public($pem);
if (!$keyResource) jsonError('Invalid public key format');

// Check for duplicate credential
$existing = getPasskeyByCredentialId($database, $credentialId);
if ($existing) jsonError('Credential already registered');

// Store the passkey
$database->insert($TABLE_USER_PASSKEYS, [
    'user_id' => $userId,
    'credential_id' => $credentialId,
    'public_key' => $publicKeyB64,
    'algorithm' => $algorithm,
    'counter' => 0,
    'transports' => json_encode($transports),
    'device_name' => $deviceName ?: parseDeviceName($_SERVER['HTTP_USER_AGENT'] ?? ''),
    'created_at' => date('Y-m-d H:i:s'),
]);

$passkeyId = $database->id();

jsonResponse([
    'success' => true,
    'passkey_id' => (int)$passkeyId,
]);
