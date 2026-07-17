<?php
/**
 * auth.php — login, logout, registro. 'recuperar' queda deshabilitado
 * (ver Fase 1: exponía contraseñas en texto plano y apuntaba a una
 * tabla que ya no existe en este esquema).
 */

switch ($action) {

  case 'login':
    requireFields($body, ['correo', 'contrasena']);
    $correo     = trim($body['correo']);
    $contrasena = trim($body['contrasena']);

    $st = $pdo->prepare("SELECT id, nombre, rol, contrasena FROM usuarios WHERE correo = ?");
    $st->execute([$correo]);
    $user = $st->fetch();

    if (!$user) {
      responderError('Correo o contraseña incorrectos', 401);
    }

    // Únicamente contraseñas hasheadas. El fallback de texto plano fue
    // eliminado en Fase 1: era una puerta de acceso permanente, no una
    // migración temporal.
    if (!password_verify($contrasena, $user['contrasena'])) {
      responderError('Correo o contraseña incorrectos', 401);
    }

    // Si el hash usa un algoritmo desactualizado, se re-hashea (esto sí
    // es una migración legítima: solo aplica sobre hashes ya válidos).
    if (password_needs_rehash($user['contrasena'], PASSWORD_DEFAULT)) {
      $pdo->prepare("UPDATE usuarios SET contrasena = ? WHERE id = ?")
          ->execute([password_hash($contrasena, PASSWORD_DEFAULT), $user['id']]);
    }

    if ($user['rol'] === 'admin') {
      $_SESSION['admin_logged_in'] = true;
      $_SESSION['admin_id']        = $user['id'];
    }

    responderOk([
      'id'     => $user['id'],
      'nombre' => $user['nombre'],
      'rol'    => $user['rol'],
    ]);
    break;

  case 'logout':
    session_destroy();
    responderOk();
    break;

  case 'crear_cuenta':
    requireFields($body, ['nombre', 'correo', 'contrasena']);
    $n = trim($body['nombre']);
    $c = trim($body['correo']);
    $p = trim($body['contrasena']);

    if (!filter_var($c, FILTER_VALIDATE_EMAIL)) {
      responderError('El correo no tiene un formato válido', 400);
    }
    if (strlen($p) < 4) {
      responderError('La contraseña debe tener al menos 4 caracteres', 400);
    }

    $st = $pdo->prepare("SELECT id FROM usuarios WHERE correo = ?");
    $st->execute([$c]);
    if ($st->fetch()) {
      responderError('El correo ya está registrado', 409);
    }

    try {
      $hash = password_hash($p, PASSWORD_DEFAULT);
      $pdo->prepare("INSERT INTO usuarios (nombre, correo, contrasena) VALUES (?,?,?)")
          ->execute([$n, $c, $hash]);
      responderOk([], 201);
    } catch (Exception $e) {
      responderError('Error al registrar usuario: ' . $e->getMessage(), 500);
    }
    break;

  case 'recuperar':
    // Eliminado (auditoría, punto 1): un endpoint nunca debe devolver
    // contraseñas al cliente, ni siquiera a un admin. La recuperación
    // real requiere un token temporal enviado por correo y validado en
    // backend — pendiente como tarea aparte.
    responderError('Función de recuperación deshabilitada. Contacta al administrador.', 410);
    break;

  default:
    responderError('Acción de auth desconocida: ' . htmlspecialchars($action), 404);
}