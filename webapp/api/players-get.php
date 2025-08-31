<?

if (!isset($_REQUEST['za'])) {
	exit();
}

require  'db.php';


ini_set('error_reporting', E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

if($_REQUEST['playerLogin']) {
	$players = $database->select($TABLE_PLAYERS, "data", ["login" => $_REQUEST['playerLogin']]);
	echo json_encode($players);
}

