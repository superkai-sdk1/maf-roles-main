<?

require  'medoo.php';
use Medoo\Medoo;

$database = new Medoo(array(
	'database_type' => 'mysql',
	'database_name' => '******',
	'server' => 'localhost',
	'username' => '******',
	'password' => '******',
	'charset' => 'utf8',
	'port' => 31006,
	'prefix' => '',
));

$TABLE_PLAYERS = 'players';
