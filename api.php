<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-App-Token');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── AUTENTICACION ──
$config_file = __DIR__ . '/config.php';
if (!file_exists($config_file)) {
    http_response_code(500);
    echo json_encode(['error' => 'Config no encontrada']);
    exit;
}
require $config_file;

if (!defined('TOKEN_HASH')) {
    http_response_code(500);
    echo json_encode(['error' => 'Config invalida']);
    exit;
}

$token = $_SERVER['HTTP_X_APP_TOKEN'] ?? '';
if (!password_verify($token, TOKEN_HASH)) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

// ── CONFIG ──
$MAX_BYTES    = 524288;
$WEEKS_DIR    = __DIR__ . '/semanas/';
$COMPRA_FILE  = __DIR__ . '/data-compra.json';
$PELIS_FILE   = __DIR__ . '/data-pelis.json';
$TAREAS_FILE  = __DIR__ . '/data-tareas.json';
$DATOS_FILE   = __DIR__ . '/data-datos.json';

// Migracion: data.json -> data-compra.json (una sola vez)
$OLD_COMPRA = __DIR__ . '/data.json';
if (file_exists($OLD_COMPRA) && !file_exists($COMPRA_FILE)) {
    rename($OLD_COMPRA, $COMPRA_FILE);
}

if (!is_dir($WEEKS_DIR)) mkdir($WEEKS_DIR, 0755, true);

$default_menu = [
    'lunes'     => ['comida' => '', 'cena' => ''],
    'martes'    => ['comida' => '', 'cena' => ''],
    'miercoles' => ['comida' => '', 'cena' => ''],
    'jueves'    => ['comida' => '', 'cena' => ''],
    'viernes'   => ['comida' => '', 'cena' => ''],
    'sabado'    => ['comida' => '', 'cena' => ''],
    'domingo'   => ['comida' => '', 'cena' => ''],
];

function limpiarViejas($dir) {
    $limite = strtotime('-1 month');
    foreach (glob($dir . 'menu-*.json') as $f) {
        if (filemtime($f) < $limite) unlink($f);
    }
}

function semanaValida($s) {
    return preg_match('/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/', $s);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'compra';
$week   = $_GET['week']   ?? '';

if ($method === 'GET') {
    limpiarViejas($WEEKS_DIR);
    if ($action === 'menu') {
        if (!semanaValida($week)) { http_response_code(400); echo json_encode(['error' => 'Semana invalida']); exit; }
        $file = $WEEKS_DIR . 'menu-' . $week . '.json';
        echo file_exists($file) ? file_get_contents($file) : json_encode($default_menu);
    } elseif ($action === 'compra') {
        echo file_exists($COMPRA_FILE) ? file_get_contents($COMPRA_FILE) : json_encode(['pendiente' => [], 'eliminados' => []]);
    } elseif ($action === 'pelis') {
        echo file_exists($PELIS_FILE) ? file_get_contents($PELIS_FILE) : json_encode(['items' => []]);
    } elseif ($action === 'tareas') {
        echo file_exists($TAREAS_FILE) ? file_get_contents($TAREAS_FILE) : json_encode(['pendiente' => [], 'eliminados' => []]);
    } elseif ($action === 'datos') {
        echo file_exists($DATOS_FILE) ? file_get_contents($DATOS_FILE) : json_encode(new stdClass);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Accion desconocida']);
    }
    exit;
}

if ($method === 'POST') {
    $body = file_get_contents('php://input', false, null, 0, $MAX_BYTES + 1);
    if (strlen($body) > $MAX_BYTES) { http_response_code(413); echo json_encode(['error' => 'Payload demasiado grande']); exit; }
    $data = json_decode($body, true);
    if ($data === null) { http_response_code(400); echo json_encode(['error' => 'JSON invalido']); exit; }

    if ($action === 'menu') {
        if (!semanaValida($week)) { http_response_code(400); echo json_encode(['error' => 'Semana invalida']); exit; }
        file_put_contents($WEEKS_DIR . 'menu-' . $week . '.json', json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    } elseif ($action === 'compra') {
        file_put_contents($COMPRA_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    } elseif ($action === 'pelis') {
        file_put_contents($PELIS_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    } elseif ($action === 'tareas') {
        file_put_contents($TAREAS_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    } elseif ($action === 'datos') {
        file_put_contents($DATOS_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    echo json_encode(['ok' => true]);
    exit;
}
