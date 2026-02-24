<?php

require  'medoo.php';
use Medoo\Medoo;

$database = new Medoo(array(
	'database_type' => 'mysql',
	'database_name' => 'DB_NAME_PLACEHOLDER',
	'server' => 'localhost',
	'username' => 'DB_USER_PLACEHOLDER',
	'password' => 'DB_PASS_PLACEHOLDER',
	'charset' => 'utf8',
	'port' => DB_PORT_PLACEHOLDER,
	'prefix' => '',
	'error' => PDO::ERRMODE_EXCEPTION,
));

$TABLE_PLAYERS = 'players';
