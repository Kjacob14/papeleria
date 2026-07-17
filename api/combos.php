<?php
/**
 * combos.php — catálogo de combos (solo lectura pública).
 */

switch ($action) {

  case 'combos':
    try {
      $rows = $pdo->query(
        "SELECT id, nombre, descripcion, precio, imagen, etiqueta FROM combos ORDER BY id"
      )->fetchAll();
      foreach ($rows as &$r) {
        $r['id']     = (int)$r['id'];
        $r['precio'] = (float)$r['precio'];
      }
      responder(200, $rows);
    } catch (Exception $e) {
      responderError('Error al obtener combos: ' . $e->getMessage(), 500);
    }
    break;

  default:
    responderError('Acción de combos desconocida: ' . htmlspecialchars($action), 404);
}