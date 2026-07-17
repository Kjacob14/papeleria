<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Papelería</title>

<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js"></script>

<link rel="stylesheet" href="styles.css?v=2">
</head>
<body>
<main>
  <header class="navbar">
    <div class="brand">
     <div class="logo">
      <img src="papeleria.jpeg" alt="Logo Papelería El Profe" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">
    </div>
      <div>
        <div style="font-weight:800;color:#000">Papelería</div>
        <div style="font-size:12px;color:rgb(1, 1, 2)">Útiles escolares y Material de oficina</div>
      </div>
    </div>
    <nav class="nav-right" id="adminPanelToggleContainer">
      <a href="#inicio">Inicio</a>
      <a href="#catalogo">Catálogo</a>
      
      <a href="#mochilita" title="Ver Mochilita" style="display:flex; align-items:center; position:relative; text-decoration:none;">
        <img src="Mochila.png" alt="Mochila" id="nav-img-mochila" style="height: 28px; width: auto; transition: transform 0.3s ease;">
        <span id="cart-badge" style="position:absolute; top:-6px; right:-10px; background:#d9534f; color:white; font-size:11px; font-weight:bold; padding:2px 6px; border-radius:10px; display:none; box-shadow:0 2px 4px rgba(0,0,0,0.2); z-index: 10;">0</span>
      </a>
      
      <input type="text" id="searchBox" placeholder="Buscar producto..." oninput="filterProducts(this.value)" />
      
      <div id="auth-nav-container">
        <button class="btn secondary" onclick="abrirModalAuth('login')">Iniciar Sesión</button>
      </div>
    </nav>
  </header>

  <div id="app-content" style="flex: 1; padding-bottom: 40px;"></div>

  <footer style="margin-top:auto; text-align:center; padding:10px 0; background:#f06a8a; color:white;">
    © <span id="year"></span> Papelería
  </footer>
</main>

<!-- ==================== MODALES ==================== -->

<div id="modalCantidad" class="modal" aria-hidden="true">
  <h3 id="mc-title">Cuantas unidades?</h3>
  <div style="text-align:center">
    <input id="mc-cantidad" type="number" min="1" max="999" value="1"
      oninput="this.value=this.value.replace(/[^0-9]/g,'');if(this.value<1)this.value=1;if(this.value.length>3)this.value=this.value.slice(0,3);" />
  </div>
  <div class="actions">
    <button class="btn" onclick="confirmAddQuantity()">Agregar</button>
    <button class="btn btn-cancel" onclick="closeModalCantidad()">Cancelar</button>
  </div>
</div>

<div id="toast" class="toast">Agregado a tu mochilita</div>

<div id="modalTicket" class="modal">
  <h3>Ticket de compra</h3>
  <div id="ticketItems" style="text-align:left; max-height:260px; overflow:auto; margin-top:8px;"></div>
  <p style="font-weight:800; text-align:right; margin-top:8px;">Total: $<span id="ticketTotal">0</span></p>
  <div style="margin-top:8px; text-align:center">Deseas recibir el ticket por correo?</div>
  <div style="display:flex; gap:8px; justify-content:center; margin-top:10px;">
    <button class="btn" onclick="showTicketEmailInput()">Si, enviarlo</button>
    <button class="btn btn-cancel" onclick="finishTicketWithoutEmail()">No, gracias</button>
  </div>
  <div id="ticketEmailRow" style="display:none; margin-top:12px;">
    <input id="ticketEmailInput" type="email" placeholder="correo@ejemplo.com" />
    <div class="actions" style="margin-top:8px;">
      <button class="btn" onclick="sendTicketByEmail()">Enviar</button>
      <button class="btn btn-cancel" onclick="closeModalTicket()">Cancelar</button>
    </div>
    <p id="ticketMsg" class="success-msg"></p>
  </div>
</div>

<!-- Modal 360 con animacion de giro -->
<div id="modal360" class="modal" aria-hidden="true" style="max-width:900px;">
  <h3 id="modal360Title">360 Viewer</h3>
  <div class="viewer360" id="viewer360">
    <div class="spin" id="viewerSpin">
      <img id="modal360Img" src="" alt="360 producto" draggable="false" />
    </div>
  </div>
  <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
    <button class="btn" id="btnPlay360"  onclick="startSpin()">Reproducir</button>
    <button class="btn secondary" id="btnPause360" onclick="stopSpin()">Pausar</button>
    <button class="btn btn-cancel" onclick="closeModal360()">Cerrar</button>
  </div>
  <p style="text-align:center;font-size:13px;color:#023;">(Vista 360 provisional)</p>
</div>

<!-- Modal 360 con drag -->
<div id="viewer360Modal" onclick="close360View(event)">
  <img id="viewer360Img" src="" alt="Vista 360" />
</div>
<div id="modalAuth" class="modal" style="max-width: 420px; padding: 25px;">
  
  <div id="auth-login-view">
    <h3>Ingresar a tu Cuenta</h3>
    <input id="authLoginEmail" type="email" placeholder="Correo electrónico" style="width:100%; padding:10px; margin-bottom:12px; border-radius:6px; border:1px solid #ccc;" />
    <input id="authLoginPass" type="password" placeholder="Contraseña" style="width:100%; padding:10px; margin-bottom:15px; border-radius:6px; border:1px solid #ccc;" />
    <button class="btn" style="width:100%;" onclick="ejecutarLoginPublico()">Iniciar Sesión</button>
    <p style="text-align:center; margin-top:15px; font-size:14px;">
      ¿No tienes cuenta? <a style="color:var(--accent); cursor:pointer; font-weight:700;" onclick="cambiarVistaAuth('registro')">Regístrate aquí</a>
    </p>
  </div>

  <div id="auth-register-view" style="display:none;">
    <h3>Crear una Cuenta</h3>
    <input id="authRegNombre" type="text" placeholder="Nombre completo" style="width:100%; padding:10px; margin-bottom:12px; border-radius:6px; border:1px solid #ccc;" />
    <input id="authRegEmail" type="email" placeholder="Correo electrónico" style="width:100%; padding:10px; margin-bottom:12px; border-radius:6px; border:1px solid #ccc;" />
    <input id="authRegPass" type="password" placeholder="Contraseña" style="width:100%; padding:10px; margin-bottom:15px; border-radius:6px; border:1px solid #ccc;" />
    <button class="btn" style="width:100%;" onclick="ejecutarRegistroPublico()">Registrarse</button>
    <p style="text-align:center; margin-top:15px; font-size:14px;">
      ¿Ya tienes cuenta? <a style="color:var(--accent); cursor:pointer; font-weight:700;" onclick="cambiarVistaAuth('login')">Inicia sesión</a>
    </p>
  </div>

  <div class="actions" style="margin-top:10px;">
    <button class="btn btn-cancel" onclick="cerrarModalAuth()">Cerrar</button>
  </div>
  <p id="authModalMsg" style="text-align:center; margin-top:10px; font-weight:600; color:#d9534f; display:none;"></p>
</div>

<!-- Panel flotante del asistente -->
<div id="assistantBox" role="dialog" aria-label="Asistente El Profe" aria-hidden="true">
  <div class="mini-header">
    <h4>🤖 Asistente El Profe</h4>
    <button class="small-btn" id="assistantToggleBtn" aria-label="Cerrar asistente">Cerrar ✕</button>
  </div>
  <div id="assistantMessages" class="mini-body" role="log" aria-live="polite" aria-label="Conversación con el asistente"></div>
  <div id="assistantFooter" class="mini-footer">
    <label for="assistantInput" class="sr-only">Escribe tu pregunta para el asistente</label>
    <input type="text" id="assistantInput" placeholder="Escribe tu pregunta..." aria-label="Escribe tu pregunta" />
    <button class="small-btn" id="assistantSendBtn" aria-label="Enviar pregunta">↑</button>
    <button class="small-btn" id="assistantVoiceBtn" aria-label="Activar entrada de voz" aria-pressed="false">🎤</button>
  </div>
</div>

<!-- Botones flotantes -->
<button class="chatbot-btn" id="chatbotBtn" title="Abrir asistente" aria-label="Abrir asistente virtual" aria-haspopup="dialog" aria-expanded="false" aria-controls="assistantBox">&#128172;</button>
<button class="voice-btn"   id="voiceBtn"   title="Asistente de voz" aria-label="Activar asistente de voz" aria-pressed="false">&#127908;</button>

<script src="app.js"></script>
</body>
</html>