<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if (!isset($_POST['za']) || !isset($_POST['roomId'])) {
    exit();
}
$roomId = $_POST['roomId'];
$file = __DIR__ . "/avatars_{$roomId}.json";
$avatars = [];
if (file_exists($file)) {
    $avatars = json_decode(file_get_contents($file), true) ?: [];
}
if (isset($_POST['avatars'])) {
    // Массовое обновление avatars
    $newAvatars = json_decode($_POST['avatars'], true);
    if (is_array($newAvatars)) {
        foreach ($newAvatars as $login => $v) {
            $avatars[$login] = $v;
        }
    }
} elseif (isset($_POST['login']) && isset($_POST['avatar'])) {
    // Одиночное обновление
    $avatars[$_POST['login']] = $_POST['avatar'];
}
file_put_contents($file, json_encode($avatars, JSON_UNESCAPED_UNICODE));
echo 'OK';
