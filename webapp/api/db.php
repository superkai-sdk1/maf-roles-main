<?php

require  'medoo.php';
use Medoo\Medoo;

$database = new Medoo(array(
	'database_type' => 'mysql',
	'database_name' => 'webrarium_mafia',
	'server' => 'localhost',
	'username' => 'kai',
	'password' => 'Spotify0660',
	'charset' => 'utf8',
	'port' => 3306,
	'prefix' => '',
	'error' => PDO::ERRMODE_EXCEPTION,
));

$TABLE_PLAYERS = 'players';
