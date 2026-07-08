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

    // Fase 2: se adjunta el detalle normalizado de cada pedido (tabla
    // pedido_detalles) como campo adicional 'detalles'. El campo 'items'
    // (texto) se conserva intacto por compatibilidad con admin.js actual;
    // 'detalles' queda disponible para cuando se migre esa vista a usar
    // datos estructurados en vez de parsear texto.
    $stDet = $pdo->prepare(
      "SELECT producto_id, combo_id, nombre_snapshot, cantidad, precio_unitario, subtotal
       FROM pedido_detalles WHERE pedido_id = ?"
    );
    foreach ($rows as &$r) {
      $r['total'] = (float)$r['total'];
      $stDet->execute([$r['id']]);
      $r['detalles'] = $stDet->fetchAll();
      foreach ($r['detalles'] as &$d) {
        $d['producto_id']     = $d['producto_id'] !== null ? (int)$d['producto_id'] : null;
        $d['combo_id']        = $d['combo_id'] !== null ? (int)$d['combo_id'] : null;
        $d['cantidad']        = (int)$d['cantidad'];
        $d['precio_unitario'] = (float)$d['precio_unitario'];
        $d['subtotal']        = (float)$d['subtotal'];
      }
    }
    echo json_encode($rows);
    break;

  case 'guardar_pedido':
    try {
      $carrito = $body['carrito'] ?? [];
      if (!is_array($carrito) || count($carrito) === 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'El carrito está vacío']);
        break;
      }

      $pdo->beginTransaction();

      // ── El servidor recalcula cada línea y el total. Nunca se confía
      //    en 'total' ni 'precio' enviados por el cliente. ──
      $totalCalculado = 0.0;
      $lineasDetalle  = []; // para pedido_detalles / items legibles
      $descuentos     = []; // producto_id => cantidad a descontar (agregado)

      foreach ($carrito as $item) {
        $tipo             = $item['tipo'] ?? '';
        $cantidadComprada = (int)($item['cantidad'] ?? 0);

        if ($cantidadComprada <= 0) {
          throw new Exception('Cantidad inválida en el carrito');
        }

        if ($tipo === 'Combo') {
          // El combo se identifica por id si viene; si no, por nombre (compatibilidad).
          if (!empty($item['id'])) {
            $stCombo = $pdo->prepare("SELECT id, nombre, precio FROM combos WHERE id = ?");
            $stCombo->execute([(int)$item['id']]);
          } else {
            $stCombo = $pdo->prepare("SELECT id, nombre, precio FROM combos WHERE nombre = ?");
            $stCombo->execute([$item['nombre'] ?? '']);
          }
          $combo = $stCombo->fetch();
          if (!$combo) throw new Exception('Combo no encontrado: ' . ($item['nombre'] ?? $item['id'] ?? '?'));

          $precioUnitario   = (float)$combo['precio'];
          $totalCalculado  += $precioUnitario * $cantidadComprada;
          $lineasDetalle[]  = [
            'producto_id' => null,
            'combo_id'    => (int)$combo['id'],
            'nombre'      => $combo['nombre'],
            'cantidad'    => $cantidadComprada,
            'precio_unitario' => $precioUnitario,
          ];

          $stProd = $pdo->prepare("SELECT producto_id, cantidad FROM combo_productos WHERE combo_id = ?");
          $stProd->execute([$combo['id']]);
          foreach ($stProd->fetchAll() as $comp) {
            $pid = (int)$comp['producto_id'];
            $descuentos[$pid] = ($descuentos[$pid] ?? 0) + ($comp['cantidad'] * $cantidadComprada);
          }

        } else {
          // Producto individual: identificado por id si viene; si no, por nombre (compatibilidad).
          if (!empty($item['id'])) {
            $stProd = $pdo->prepare("SELECT id, nombre, precio, stock FROM productos WHERE id = ?");
            $stProd->execute([(int)$item['id']]);
          } else {
            $stProd = $pdo->prepare("SELECT id, nombre, precio, stock FROM productos WHERE nombre = ?");
            $stProd->execute([$item['nombre'] ?? '']);
          }
          $prod = $stProd->fetch();
          if (!$prod) throw new Exception('Producto no encontrado: ' . ($item['nombre'] ?? $item['id'] ?? '?'));

          $pid = (int)$prod['id'];
          if ($prod['stock'] < $cantidadComprada) {
            throw new Exception('Stock insuficiente para: ' . $prod['nombre']);
          }

          $precioUnitario   = (float)$prod['precio'];
          $totalCalculado  += $precioUnitario * $cantidadComprada;
          $lineasDetalle[]  = [
            'producto_id' => $pid,
            'combo_id'    => null,
            'nombre'      => $prod['nombre'],
            'cantidad'    => $cantidadComprada,
            'precio_unitario' => $precioUnitario,
          ];

          $descuentos[$pid] = ($descuentos[$pid] ?? 0) + $cantidadComprada;
        }
      }

      // Verificación final de stock disponible (por si un mismo producto
      // aparece repartido entre combos y compra individual en el mismo pedido).
      foreach ($descuentos as $pid => $cantidadTotal) {
        $st = $pdo->prepare("SELECT stock FROM productos WHERE id = ?");
        $st->execute([$pid]);
        $stockActual = $st->fetchColumn();
        if ($stockActual === false || (int)$stockActual < $cantidadTotal) {
          throw new Exception('Stock insuficiente para el producto ID ' . $pid);
        }
      }

      // Items legible para compatibilidad con el panel admin actual (columna de texto).
      $itemsTexto = implode('; ', array_map(function ($l) {
        return $l['nombre'] . ' x' . $l['cantidad'] . ' - $' . number_format($l['precio_unitario'] * $l['cantidad'], 2);
      }, $lineasDetalle));

      $pedidoId = $body['id'] ?? ('PED-' . time() . '-' . substr(bin2hex(random_bytes(3)), 0, 6));
      $fecha    = $body['fecha'] ?? date('Y-m-d H:i:s');
      $correo   = trim($body['correo'] ?? '');

      $st = $pdo->prepare("INSERT INTO pedidos (pedido_id, fecha, items, total, correo) VALUES (?,?,?,?,?)");
      $st->execute([$pedidoId, $fecha, $itemsTexto, $totalCalculado, $correo]);

      // Fase 2: además del texto legible en pedidos.items (compatibilidad),
      // se guarda cada línea de forma normalizada en pedido_detalles,
      // referenciando producto_id/combo_id reales — no nombres de texto.
      $stDetalle = $pdo->prepare(
        "INSERT INTO pedido_detalles (pedido_id, producto_id, combo_id, nombre_snapshot, cantidad, precio_unitario)
         VALUES (?,?,?,?,?,?)"
      );
      foreach ($lineasDetalle as $l) {
        $stDetalle->execute([
          $pedidoId,
          $l['producto_id'],
          $l['combo_id'],
          $l['nombre'],
          $l['cantidad'],
          $l['precio_unitario'],
        ]);
      }

      // Descontar stock, siempre por producto_id.
      foreach ($descuentos as $pid => $cantidadTotal) {
        $pdo->prepare("UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE id = ?")
            ->execute([$cantidadTotal, $pid]);
      }

      $pdo->commit();
      echo json_encode(['ok' => true, 'id' => $pedidoId, 'total' => $totalCalculado]);
    } catch (Exception $e) {
      if ($pdo->inTransaction()) $pdo->rollBack();
      http_response_code(400);
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
      // Únicamente contraseñas hasheadas. El fallback de texto plano fue
      // eliminado: era una puerta de acceso permanente, no una migración
      // temporal (ver auditoría, punto 1 y migrar_passwords.php).
      $passOk = password_verify($contrasena, $user['contrasena']);

      if ($passOk) {
        // Si el hash usa un algoritmo desactualizado, se re-hashea (esto sí
        // es una migración legítima: solo aplica sobre hashes ya válidos).
        if (password_needs_rehash($user['contrasena'], PASSWORD_DEFAULT)) {
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
    // Eliminado (auditoría, punto 1): un endpoint nunca debe devolver
    // contraseñas al cliente, ni siquiera a un admin. Además apuntaba a una
    // tabla 'administradores' que ya no existe en este esquema (usuarios).
    // La recuperación real requiere un token temporal enviado por correo y
    // procesado íntegramente en el backend — pendiente de implementar como
    // tarea aparte, no como parche rápido.
    http_response_code(410);
    echo json_encode(['ok' => false, 'error' => 'Función de recuperación deshabilitada. Contacta al administrador.']);
    break;

  default:
    http_response_code(404);
    echo json_encode(['error' => 'Acción desconocida: ' . htmlspecialchars($action)]);
}