<?php
// Временный скрипт для диагностики структуры ответа GoMafia API
// Запуск: php debug-gomafia.php

$ctx = stream_context_create([
    'http' => [
        'timeout' => 12,
        'header' => "User-Agent: MafBoard-Sync/1.0\r\nAccept: application/json,text/html\r\n",
        'ignore_errors' => true,
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
    ]
]);

// 1. Получаем buildId
echo "Fetching gomafia.pro...\n";
$html = @file_get_contents('https://gomafia.pro/', false, $ctx);
if (!$html) {
    // Fallback: cURL
    if (function_exists('curl_init')) {
        $ch = curl_init('https://gomafia.pro/');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_USERAGENT => 'MafBoard-Sync/1.0',
        ]);
        $html = curl_exec($ch);
        curl_close($ch);
    }
}

if (!$html) {
    echo "ERROR: Cannot fetch gomafia.pro\n";
    exit(1);
}

preg_match('/"buildId"\s*:\s*"([^"]+)"/', $html, $bm);
if (!$bm) {
    echo "ERROR: Cannot find buildId\n";
    exit(1);
}
$buildId = $bm[1];
echo "buildId: {$buildId}\n\n";

// 2. Загружаем данные игрока ID=9382
$userId = 9382;
$url = "https://gomafia.pro/_next/data/{$buildId}/stats/{$userId}.json";
echo "Fetching {$url}\n";

$json = @file_get_contents($url, false, $ctx);
if (!$json && function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'MafBoard-Sync/1.0',
    ]);
    $json = curl_exec($ch);
    curl_close($ch);
}

if (!$json) {
    echo "ERROR: Cannot fetch player data\n";
    exit(1);
}

$data = json_decode($json, true);

// 3. Выводим все ключи serverData
echo "\n=== pageProps keys ===\n";
if (isset($data['pageProps'])) {
    print_r(array_keys($data['pageProps']));
}

echo "\n=== serverData keys ===\n";
if (isset($data['pageProps']['serverData'])) {
    print_r(array_keys($data['pageProps']['serverData']));
}

echo "\n=== user object (ALL fields) ===\n";
if (isset($data['pageProps']['serverData']['user'])) {
    print_r($data['pageProps']['serverData']['user']);
}

echo "\n=== club / clubs / team fields in serverData ===\n";
$sd = $data['pageProps']['serverData'] ?? [];
foreach ($sd as $key => $val) {
    if (stripos($key, 'club') !== false || stripos($key, 'team') !== false || stripos($key, 'org') !== false) {
        echo "{$key}: ";
        print_r($val);
        echo "\n";
    }
}

echo "\n=== Full serverData (truncated) ===\n";
$full = json_encode($sd, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
echo substr($full, 0, 5000) . "\n...\n";

