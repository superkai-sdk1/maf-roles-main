<?php
// =====================================================
// PassKey Setup — Standalone page for external browser
// Opens from Telegram → default browser to register PassKey
// GET: ?token=xxx
// =====================================================

require_once __DIR__ . '/auth-helpers.php';

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
$error = '';
$userName = '';

if (empty($token)) {
    $error = 'Ссылка недействительна. Попробуйте ещё раз из приложения.';
} else {
    $session = validateSession($database, $token);
    if (!$session) {
        $error = 'Сессия истекла. Войдите в приложение и попробуйте снова.';
    } else {
        $userId = $session['user_id'];
        if (!$userId) {
            $error = 'Пользователь не найден.';
        } else {
            $user = getUserById($database, $userId);
            if ($user) {
                $userName = $user['display_name'] ?: ($user['telegram_first_name'] ?: ($user['gomafia_nickname'] ?: ''));
            }
        }
    }
}

$safeToken = htmlspecialchars($token, ENT_QUOTES, 'UTF-8');
$safeUserName = htmlspecialchars($userName, ENT_QUOTES, 'UTF-8');
$safeError = htmlspecialchars($error, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>MafBoard — Настройка PassKey</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#0a0814" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', Roboto, sans-serif;
    background: #0a0a1a;
    color: #fff;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 20px;
    padding: 32px 28px;
    max-width: 380px;
    width: 100%;
    text-align: center;
  }
  .icon { font-size: 3em; margin-bottom: 12px; }
  .title { font-size: 1.3em; font-weight: 700; margin-bottom: 6px; }
  .subtitle { font-size: 0.85em; color: rgba(255,255,255,0.4); margin-bottom: 20px; line-height: 1.5; }
  .user-name { color: rgba(168,85,247,0.9); font-weight: 600; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 14px 24px;
    background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.3);
    color: #c084fc; font-size: 1em; font-weight: 600;
    border-radius: 14px; cursor: pointer;
    transition: all 0.2s;
  }
  .btn:hover { background: rgba(168,85,247,0.25); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary {
    background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.5); margin-top: 10px;
  }
  .error { color: #ff453a; font-size: 0.85em; margin: 12px 0; line-height: 1.5; }
  .success-icon { font-size: 3.5em; margin-bottom: 8px; }
  .hint { font-size: 0.8em; color: rgba(255,255,255,0.3); margin-top: 16px; line-height: 1.5; }
  .spinner {
    display: inline-block; width: 18px; height: 18px;
    border: 2px solid rgba(192,132,252,0.3);
    border-top-color: #c084fc; border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  #state-creating .card { border-color: rgba(168,85,247,0.15); }
  #state-success .card { border-color: rgba(34,197,94,0.15); }
  #state-error .card { border-color: rgba(255,69,58,0.15); }
  .hidden { display: none !important; }
</style>
</head>
<body>

<!-- Error state (no valid session) -->
<?php if ($error): ?>
<div id="state-error">
  <div class="card">
    <div class="icon">&#x26A0;&#xFE0F;</div>
    <div class="title">Ошибка</div>
    <div class="error"><?= $safeError ?></div>
    <div class="hint">Вернитесь в Telegram и попробуйте ещё раз.</div>
  </div>
</div>
<?php else: ?>

<!-- Prompt state -->
<div id="state-prompt">
  <div class="card">
    <div class="icon">&#x1F510;</div>
    <div class="title">Настройка PassKey</div>
    <div class="subtitle">
      <?php if ($safeUserName): ?>
        <span class="user-name"><?= $safeUserName ?></span>, настройте
      <?php else: ?>
        Настройте
      <?php endif; ?>
      вход по биометрии для быстрого доступа к MafBoard.
    </div>
    <button class="btn" id="btn-create" onclick="startRegistration()">
      Создать PassKey
    </button>
    <div class="hint">
      Будет использован Face ID, Touch ID или PIN-код вашего устройства.
    </div>
  </div>
</div>

<!-- Creating state -->
<div id="state-creating" class="hidden">
  <div class="card">
    <div class="icon">&#x1F510;</div>
    <div class="title">Создание PassKey...</div>
    <div class="subtitle">Подтвердите биометрию на вашем устройстве</div>
    <div><span class="spinner"></span></div>
  </div>
</div>

<!-- Success state -->
<div id="state-success" class="hidden">
  <div class="card">
    <div class="success-icon">&#x2705;</div>
    <div class="title">PassKey создан!</div>
    <div class="subtitle">
      Теперь вы можете входить в MafBoard через биометрию — Face ID, Touch ID или PIN-код.
    </div>
    <button class="btn" onclick="window.close()">Закрыть</button>
    <div class="hint">Можете закрыть эту вкладку и вернуться в Telegram.</div>
  </div>
</div>

<!-- Fail state -->
<div id="state-fail" class="hidden">
  <div class="card">
    <div class="icon">&#x274C;</div>
    <div class="title">Не удалось создать</div>
    <div class="error" id="fail-message"></div>
    <button class="btn" onclick="startRegistration()">Попробовать снова</button>
    <button class="btn btn-secondary" onclick="window.close()">Закрыть</button>
  </div>
</div>

<script>
const TOKEN = <?= json_encode($token) ?>;
const AUTH_BASE = '/login/';

function showState(id) {
  ['state-prompt','state-creating','state-success','state-fail'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

function base64urlToBuffer(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function startRegistration() {
  showState('state-creating');

  try {
    const optRes = await fetch(AUTH_BASE + 'passkey-register-options.php?token=' + encodeURIComponent(TOKEN));
    const options = await optRes.json();
    if (options.error) throw new Error(options.error);

    const pk = options.publicKey;
    pk.challenge = base64urlToBuffer(pk.challenge);
    pk.user.id = base64urlToBuffer(pk.user.id);
    if (pk.excludeCredentials) {
      pk.excludeCredentials = pk.excludeCredentials.map(c => ({...c, id: base64urlToBuffer(c.id)}));
    }

    const credential = await navigator.credentials.create({ publicKey: pk });

    const response = credential.response;
    const publicKeyBytes = response.getPublicKey();
    const algorithm = response.getPublicKeyAlgorithm();
    const authData = response.getAuthenticatorData();
    const transports = response.getTransports ? response.getTransports() : [];

    const regRes = await fetch(AUTH_BASE + 'passkey-register.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: TOKEN,
        credentialId: bufferToBase64url(credential.rawId),
        publicKey: bufferToBase64(publicKeyBytes),
        publicKeyAlgorithm: algorithm,
        authenticatorData: bufferToBase64url(authData),
        clientDataJSON: bufferToBase64url(response.clientDataJSON),
        transports: transports,
        deviceName: null,
      }),
    });
    const data = await regRes.json();

    if (data.success) {
      showState('state-success');
    } else {
      throw new Error(data.error || 'Ошибка регистрации');
    }
  } catch (e) {
    let msg = e.message || 'Неизвестная ошибка';
    if (e.name === 'NotAllowedError') msg = 'Операция отменена пользователем';
    if (e.name === 'InvalidStateError') msg = 'Этот ключ уже зарегистрирован';
    if (e.name === 'NotSupportedError') msg = 'PassKey не поддерживается в этом браузере';
    document.getElementById('fail-message').textContent = msg;
    showState('state-fail');
  }
}
</script>

<?php endif; ?>
</body>
</html>
