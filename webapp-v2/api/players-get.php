<?php

if (!isset($_REQUEST['za'])) {
	exit();
}

require 'db.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

if (!empty($_REQUEST['playerLogin'])) {
	$rows = $database->select($TABLE_PLAYERS, "data", ["login" => $_REQUEST['playerLogin']]);
	$results = [];
	foreach ($rows as $jsonStr) {
		$parsed = json_decode($jsonStr, true);
		if ($parsed) {
			$results[] = [
				'login' => isset($parsed['login']) ? $parsed['login'] : null,
				'avatar_link' => isset($parsed['avatar_link']) ? $parsed['avatar_link'] : null,
				'id' => isset($parsed['id']) ? $parsed['id'] : null,
				'title' => isset($parsed['title']) ? $parsed['title'] : null,
			];
		}
	}
	echo json_encode($results, JSON_UNESCAPED_UNICODE);
} else {
	echo json_encode([]);
}
