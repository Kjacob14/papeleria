<?php
// ── Credenciales ─────────────────────────────────────────
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'papeleria_db');
define('DB_USER', 'root');
define('DB_PASS', 'Ximena2005');          // cambia si tu MySQL tiene contraseña

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    } catch (PDOException $e) {
        http_response_code(500);
        exit(json_encode(['ok' => false, 'error' => 'DB: ' . $e->getMessage()]));
    }

    return $pdo;
}