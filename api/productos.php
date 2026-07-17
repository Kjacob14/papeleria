<?php
/**
 * productos.php — CRUD de productos.
 * Recibe $pdo, $action, $body ya resueltos por api.php (fachada).
 */

switch ($action) {

  case 'productos':
    $rows = $pdo->query(
      "SELECT id, nombre, precio, imagen, stock, variantes FROM productos ORDER BY id"
    )->fetchAll();
    foreach ($rows as &$r) {
      $r['id']        = (int)$r['id'];
      $r['precio']    = (float)$r['precio'];
      $r['stock']     = (int)$r['stock'];
      $r['variantes'] = $r['variantes'] ? json_decode($r['variantes'], true) : null;
    }
    responder(200, $rows);
    break;

  case 'agregar_producto':
    requireAdmin();
    requireFields($body, ['nombre', 'precio']);

    $nombre = trim($body['nombre']);
    $precio = $body['precio'];
    $stock  = $body['stock'] ?? 0;

    if (!is_numeric($precio) || (float)$precio < 0) {
      responderError('El precio debe ser un número mayor o igual a 0', 400);
    }
    if (!is_numeric($stock) || (int)$stock < 0) {
      responderError('El stock debe ser un número entero mayor o igual a 0', 400);
    }

    try {
      $st  = $pdo->prepare("INSERT INTO productos (nombre, precio, imagen, stock, variantes) VALUES (?,?,?,?,?)");
      $var = isset($body['variantes']) && $body['variantes']
             ? json_encode($body['variantes'], JSON_UNESCAPED_UNICODE) : null;
      $st->execute([$nombre, (float)$precio, $body['imagen'] ?? '', (int)$stock, $var]);
      responderOk(['id' => (int)$pdo->lastInsertId()], 201);
    } catch (Exception $e) {
      responderError('Error al guardar el producto: ' . $e->getMessage(), 500);
    }
    break;

  case 'editar_producto':
    requireAdmin();
    requireFields($body, ['id', 'nombre', 'precio']);
    $id     = requireIdValido($body['id']);
    $nombre = trim($body['nombre']);
    $precio = $body['precio'];
    $stock  = $body['stock'] ?? 0;

    if (!is_numeric($precio) || (float)$precio < 0) {
      responderError('El precio debe ser un número mayor o igual a 0', 400);
    }
    if (!is_numeric($stock) || (int)$stock < 0) {
      responderError('El stock debe ser un número entero mayor o igual a 0', 400);
    }

    try {
      // Verificar que el producto exista antes de intentar editarlo.
      $chk = $pdo->prepare("SELECT id FROM productos WHERE id = ?");
      $chk->execute([$id]);
      if (!$chk->fetch()) {
        responderError('Producto no encontrado', 404);
      }

      $st  = $pdo->prepare("UPDATE productos SET nombre=?, precio=?, imagen=?, stock=?, variantes=? WHERE id=?");
      $var = isset($body['variantes']) && $body['variantes']
             ? json_encode($body['variantes'], JSON_UNESCAPED_UNICODE) : null;
      $st->execute([$nombre, (float)$precio, $body['imagen'] ?? '', (int)$stock, $var, $id]);
      responderOk();
    } catch (Exception $e) {
      responderError('Error al editar el producto: ' . $e->getMessage(), 500);
    }
    break;

  case 'eliminar_producto':
    requireAdmin();
    requireFields($body, ['id']);
    $id = requireIdValido($body['id']);

    try {
      $chk = $pdo->prepare("SELECT id FROM productos WHERE id = ?");
      $chk->execute([$id]);
      if (!$chk->fetch()) {
        responderError('Producto no encontrado', 404);
      }

      $st = $pdo->prepare("DELETE FROM productos WHERE id=?");
      $st->execute([$id]);
      responderOk();
    } catch (Exception $e) {
      responderError('Error al eliminar el producto: ' . $e->getMessage(), 500);
    }
    break;

  default:
    responderError('Acción de productos desconocida: ' . htmlspecialchars($action), 404);
}