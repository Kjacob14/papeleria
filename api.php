<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

require_once 'db.php';

$pdo    = getDB();
$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

/* ── Guard: endpoints que requieren sesión de admin ─────── */
function requireAdmin(): void {
  if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'No autorizado']);
    exit;
  }
}

switch ($action) {

  /* ===================== COMBOS ===================== */
  case 'combos':
    try {
      $rows = $pdo->query(
        "SELECT id, nombre, descripcion, precio, imagen, etiqueta FROM combos ORDER BY id"
      )->fetchAll();
      foreach ($rows as &$r) {
        $r['id']     = (int)$r['id'];
        $r['precio'] = (float)$r['precio'];
      }
      echo json_encode($rows);
    } catch (Exception $e) {
      http_response_code(500);
      echo json_encode(['error' => $e->getMessage()]);
    }
    break;

  /* ===================== PRODUCTOS ===================== */
  case 'productos':
    $rows = $pdo->query(
      "SELECT id, nombre, precio, imagen, stock, variantes FROM productos ORDER BY id"
    )->fetchAll();
    foreach ($rows as &$r) {
      $r['id']       = (int)$r['id'];
      $r['precio']   = (float)$r['precio'];
      $r['stock']    = (int)$r['stock'];
      $r['variantes'] = $r['variantes'] ? json_decode($r['variantes'], true) : null;
    }
    echo json_encode($rows);
    break;

  case 'agregar_producto':
    requireAdmin();
    try {
      $st = $pdo->prepare("INSERT INTO productos (nombre, precio, imagen, stock, variantes) VALUES (?,?,?,?,?)");
      $var = isset($body['variantes']) && $body['variantes']
             ? json_encode($body['variantes'], JSON_UNESCAPED_UNICODE) : null;
      $st->execute([$body['nombre'], $body['precio'], $body['imagen'] ?? '', $body['stock'] ?? 0, $var]);
      echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]);
    } catch (Exception $e) {
      echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    break;

  case 'editar_producto':
    requireAdmin();
    try {
      $st = $pdo->prepare("UPDATE productos SET nombre=?, precio=?, imagen=?, stock=?, variantes=? WHERE id=?");
      $var = isset($body['variantes']) && $body['variantes']
             ? json_encode($body['variantes'], JSON_UNESCAPED_UNICODE) : null;
      $st->execute([$body['nombre'], $body['precio'], $body['imagen'] ?? '', $body['stock'] ?? 0, $var, $body['id']]);
      echo json_encode(['ok' => true]);
    } catch (Exception $e) {
      echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    break;

  case 'eliminar_producto':
    requireAdmin();
    try {
      $st = $pdo->prepare("DELETE FROM productos WHERE id=?");
      $st->execute([$body['id']]);
      echo json_encode(['ok' => true]);
    } catch (Exception $e) {
      echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    break;

  /* ===================== PEDIDOS ====================== */
  case 'pedidos':
    requireAdmin();
    $rows = $pdo->query(
      "SELECT pedido_id AS id, fecha, items, total, correo FROM pedidos ORDER BY creado DESC"
    )->fetchAll();
    foreach ($rows as &$r) $r['total'] = (float)$r['total'];
    echo json_encode($rows);
    break;

  case 'guardar_pedido':
    try {
      $pdo->beginTransaction();

      $st = $pdo->prepare("INSERT INTO pedidos (pedido_id, fecha, items, total, correo) VALUES (?,?,?,?,?)");
      $st->execute([
        $body['id']     ?? '',
        $body['fecha']  ?? '',
        $body['items']  ?? '',
        $body['total']  ?? 0,
        $body['correo'] ?? '',
      ]);

      $carrito = $body['carrito'] ?? [];
      foreach ($carrito as $item) {
        $nombre           = $item['nombre'];
        $cantidadComprada = (int)$item['cantidad'];
        $tipo             = $item['tipo'] ?? '';

        if ($tipo === 'Combo') {
          $stCombo = $pdo->prepare("SELECT id FROM combos WHERE nombre = ?");
          $stCombo->execute([$nombre]);
          $comboId = $stCombo->fetchColumn();
          if ($comboId) {
            $stProd = $pdo->prepare("SELECT producto_id, cantidad FROM combo_productos WHERE combo_id = ?");
            $stProd->execute([$comboId]);
            foreach ($stProd->fetchAll() as $comp) {
              $cantADescontar = $comp['cantidad'] * $cantidadComprada;
              $pdo->prepare("UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE id = ?")
                  ->execute([$cantADescontar, $comp['producto_id']]);
            }
          }
        } else {
          $pdo->prepare("UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE nombre = ?")
              ->execute([$cantidadComprada, $nombre]);
        }
      }

      $pdo->commit();
      echo json_encode(['ok' => true]);
    } catch (Exception $e) {
      $pdo->rollBack();
      echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    break;

  /* ====================== AUTH ======================== */
  case 'login':
    $correo     = trim($body['correo']     ?? '');
    $contrasena = trim($body['contrasena'] ?? '');

    $st = $pdo->prepare("SELECT id, nombre, rol, contrasena FROM usuarios WHERE correo = ?");
    $st->execute([$correo]);
    $user = $st->fetch();

    if ($user) {
      // Soporta contraseñas hasheadas Y texto plano (migración transparente)
      $passOk = password_verify($contrasena, $user['contrasena'])
             || $contrasena === $user['contrasena'];

      if ($passOk) {
        // Si la contraseña estaba en texto plano, la rehasheamos automáticamente
        if ($contrasena === $user['contrasena'] && !password_get_info($user['contrasena'])['algo']) {
          $pdo->prepare("UPDATE usuarios SET contrasena = ? WHERE id = ?")
              ->execute([password_hash($contrasena, PASSWORD_DEFAULT), $user['id']]);
        }

        // Si es admin, abrimos sesión PHP
        if ($user['rol'] === 'admin') {
          $_SESSION['admin_logged_in'] = true;
          $_SESSION['admin_id']        = $user['id'];
        }

        echo json_encode([
          'ok'     => true,
          'id'     => $user['id'],
          'nombre' => $user['nombre'],
          'rol'    => $user['rol'],
        ]);
      } else {
        echo json_encode(['ok' => false, 'error' => 'Correo o contraseña incorrectos']);
      }
    } else {
      echo json_encode(['ok' => false, 'error' => 'Correo o contraseña incorrectos']);
    }
    break;

  case 'logout':
    session_destroy();
    echo json_encode(['ok' => true]);
    break;

  case 'crear_cuenta':
    $n = trim($body['nombre']     ?? '');
    $c = trim($body['correo']     ?? '');
    $p = trim($body['contrasena'] ?? '');

    if (!$n || !$c || !$p) {
      echo json_encode(['ok' => false, 'error' => 'Completa todos los campos']); break;
    }

    $st = $pdo->prepare("SELECT id FROM usuarios WHERE correo = ?");
    $st->execute([$c]);
    if ($st->fetch()) {
      echo json_encode(['ok' => false, 'error' => 'El correo ya está registrado']); break;
    }

    try {
      $hash = password_hash($p, PASSWORD_DEFAULT);
      $pdo->prepare("INSERT INTO usuarios (nombre, correo, contrasena) VALUES (?,?,?)")
          ->execute([$n, $c, $hash]);
      echo json_encode(['ok' => true]);
    } catch (Exception $e) {
      echo json_encode(['ok' => false, 'error' => 'Error al registrar usuario']);
    }
    break;

  case 'recuperar':
    $e  = trim($body['email'] ?? '');
    $st = $pdo->prepare(
      "SELECT usuario, contrasena FROM administradores WHERE LOWER(email) = LOWER(?)"
    );
    $st->execute([$e]);
    $acc = $st->fetch();
    if ($acc) echo json_encode(['ok' => true,  'usuario' => $acc['usuario'], 'contrasena' => $acc['contrasena']]);
    else      echo json_encode(['ok' => false, 'error'   => 'No existe cuenta con ese correo']);
    break;

  default:
    http_response_code(404);
    echo json_encode(['error' => 'Acción desconocida: ' . htmlspecialchars($action)]);
}