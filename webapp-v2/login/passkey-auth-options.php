<?php
// =====================================================
// WebAuthn PassKey — Authentication Options
// GET (no auth required — this is the login entry point)
// Returns: PublicKeyCredentialRequestOptions
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

$challenge = createChallenge($database, 'authenticate');

// For discoverable credentials (passkeys), allowCredentials is empty —
// the browser/OS will show the user their stored passkeys for this RP
jsonResponse([
    'publicKey' => [
        'challenge' => $challenge,
        'rpId' => WEBAUTHN_RP_ID,
        'timeout' => 120000,
        'userVerification' => 'preferred',
        'allowCredentials' => [],
    ],
]);
