<?

if (!isset($_REQUEST['za'])) {
	exit();
}

require  'db.php';


ini_set('error_reporting', E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);


foreach($_REQUEST['player'] as $key => $playerData) {
	$playerLogin = json_decode($playerData)->login;
	$setArray = array("data" => $playerData, "login"=>$playerLogin);
    $database->insert($TABLE_PLAYERS, $setArray);
	print_r($playerLogin);
}
