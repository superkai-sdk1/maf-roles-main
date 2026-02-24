<?php

require  'medoo.php';
use Medoo\Medoo;

$database = new Medoo(array(
	'database_type' => 'mysql',
	'database_name' => getenv('DB_NAME') ?: 'mafboard',
	'server' => getenv('DB_HOST') ?: 'localhost',
	'username' => getenv('DB_USER') ?: 'mafboard',
	'password' => getenv('DB_PASS') ?: 'mafboard_dev',
	'charset' => 'utf8',
	'port' => (int)(getenv('DB_PORT') ?: 3306),
	'prefix' => '',
	'error' => PDO::ERRMODE_EXCEPTION,
));

$TABLE_PLAYERS = 'players';
