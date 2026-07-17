<?php
/**
 * helpers.php — utilidades compartidas por todos los módulos de /api.
 * Centraliza lo que antes estaba repetido o inconsistente en api.php:
 * respuestas JSON, códigos HTTP, y el guard de sesión de admin.
 */

/* ── Respuesta estándar ──────────────────────────────────────
 * Toda respuesta pasa por aquí para que el código HTTP y el
 * cuerpo JSON siempre vayan de la mano (antes, muchos endpoints
 * devolvían 200 OK incluso cuando 'ok' => false).
 */
function responder(int $httpCode, array $payload): void {
  http_response_code($httpCode);
  echo json_encode($payload);
  exit;
}

function responderOk(array $extra = [], int $httpCode = 200): void {
  responder($httpCode, array_merge(['ok' => true], $extra));
}

function responderError(string $mensaje, int $httpCode = 400): void {
  responder($httpCode, ['ok' => false, 'error' => $mensaje]);
}

/* ── Guard: endpoints que requieren sesión de admin ─────────
 * Sin cambios de comportamiento respecto a la versión anterior:
 * 401 + mensaje si no hay sesión de admin activa.
 */
function requireAdmin(): void {
  if (empty($_SESSION['admin_logged_in'])) {
    responderError('No autorizado', 401);
  }
}

/* ── Validación simple de campos requeridos en $body ─────────
 * Devuelve 400 de inmediato si falta alguno. Uso:
 *   requireFields($body, ['correo', 'contrasena']);
 */
function requireFields(array $body, array $campos): void {
  foreach ($campos as $campo) {
    if (!isset($body[$campo]) || $body[$campo] === '' || $body[$campo] === null) {
      responderError("Falta el campo requerido: {$campo}", 400);
    }
  }
}

/* ── Validación de ID numérico positivo (usado en editar/eliminar) ── */
function requireIdValido($valor, string $nombreCampo = 'id'): int {
  if (!is_numeric($valor) || (int)$valor <= 0) {
    responderError("El campo '{$nombreCampo}' debe ser un ID numérico válido", 400);
  }
  return (int)$valor;
}
