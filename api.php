<?php
/**
 * api.php — FACHADA ÚNICA del API.
 *
 * El frontend (app.js, admin.js) sigue llamando exactamente igual que
 * antes: api.php?action=... . Esta fase (3) no cambió ni una URL ni
 * un parámetro del lado del cliente — solo se reorganizó el backend
 * en módulos por dominio dentro de /api, para que cada archivo sea
 * manejable y no un switch() gigante.
 *
 * Este archivo NO contiene lógica de negocio: solo decide a qué
 * módulo pertenece cada 'action' y lo incluye.
 */

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

require_once 'Db.php';
require_once 'api/helpers.php';

$pdo    = getDB();
$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

/* ── Tabla de enrutamiento: action → módulo ─────────────────
 * Si agregas una acción nueva, primero decide a qué módulo
 * pertenece y agrégala aquí. Si no aparece en ningún módulo,
 * cae en el 404 genérico de abajo.
 */
$moduloPorAccion = [
  // productos.php
  'productos'         => 'productos',
  'agregar_producto'  => 'productos',
  'editar_producto'   => 'productos',
  'eliminar_producto' => 'productos',

  // combos.php
  'combos'            => 'combos',

  // pedidos.php
  'pedidos'           => 'pedidos',
  'guardar_pedido'    => 'pedidos',

  // auth.php
  'login'             => 'auth',
  'logout'            => 'auth',
  'crear_cuenta'      => 'auth',
  'recuperar'         => 'auth',
  'verificar_sesion'  => 'auth',
];

if (!isset($moduloPorAccion[$action])) {
  responderError('Acción desconocida: ' . htmlspecialchars($action), 404);
}

require __DIR__ . '/api/' . $moduloPorAccion[$action] . '.php';