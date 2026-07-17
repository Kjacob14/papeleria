<?php
/**
 * pedidos.php — listado de pedidos (admin) y creación de pedidos.
 *
 * IMPORTANTE: la lógica de guardar_pedido preserva íntegramente las
 * reglas de las Fases 1 y 2:
 *   - El precio y el total SIEMPRE se calculan aquí, en el servidor,
 *     consultando productos/combos. Nunca se confía en lo que el
 *     cliente mande como 'total' o 'precio'.
 *   - El stock se descuenta por producto_id (clave primaria), nunca
 *     por nombre de texto.
 *   - Cada línea del pedido se guarda también en pedido_detalles,
 *     de forma normalizada.
 * No se relajó ninguna validación al modularizar; solo se reubicó el
 * código y se unificaron las respuestas de error con responder().
 */

switch ($action) {

  case 'pedidos':
    requireAdmin();
    $rows = $pdo->query(
      "SELECT pedido_id AS id, fecha, items, total, correo FROM pedidos ORDER BY creado DESC"
    )->fetchAll();

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
    responder(200, $rows);
    break;

  case 'guardar_pedido':
    $carrito = $body['carrito'] ?? [];
    if (!is_array($carrito) || count($carrito) === 0) {
      responderError('El carrito está vacío', 400);
    }

    try {
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

          $precioUnitario  = (float)$combo['precio'];
          $totalCalculado += $precioUnitario * $cantidadComprada;
          $lineasDetalle[] = [
            'producto_id'     => null,
            'combo_id'        => (int)$combo['id'],
            'nombre'          => $combo['nombre'],
            'cantidad'        => $cantidadComprada,
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

          $precioUnitario  = (float)$prod['precio'];
          $totalCalculado += $precioUnitario * $cantidadComprada;
          $lineasDetalle[] = [
            'producto_id'     => $pid,
            'combo_id'        => null,
            'nombre'          => $prod['nombre'],
            'cantidad'        => $cantidadComprada,
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

      // Cada línea de forma normalizada en pedido_detalles, referenciando
      // producto_id/combo_id reales — nunca nombres de texto.
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
      responderOk(['id' => $pedidoId, 'total' => $totalCalculado], 201);
    } catch (Exception $e) {
      if ($pdo->inTransaction()) $pdo->rollBack();
      responderError($e->getMessage(), 400);
    }
    break;

  default:
    responderError('Acción de pedidos desconocida: ' . htmlspecialchars($action), 404);
}