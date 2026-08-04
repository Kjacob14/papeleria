<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Papelería</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js"></script>
<script src="theme.js"></script>
<script src="i18n.js"></script> 
<link rel="stylesheet" href="styles.css?v=8">
</head>
<body>
<main>
  <header class="navbar">
    <div class="brand">
     <div class="logo">
      <img src="papeleria.png" alt="Logo Papelería El Profe">
    </div>
      <div>
        <div class="brand-title u-text-bold" data-i18n="nav.brand_title">Papelería</div>
        <div class="brand-subtitle u-text-sm u-text-muted" data-i18n="nav.brand_subtitle">Útiles escolares y Material de oficina</div>
      </div>
    </div>
    <nav class="nav-right" id="adminPanelToggleContainer">
      
      <a href="#inicio" data-i18n="nav.home">Inicio</a>
      <a href="#catalogo" data-i18n="nav.catalog">Catálogo</a>

      <select id="langSelector" class="form-input" style="width: auto; padding: 6px; margin: 0; cursor: pointer;" onchange="changeLanguage(event)">
        <option value="es">ES</option>
        <option value="en">EN</option>
        <option value="fr">FR</option>
        <option value="zh">ZH</option>
      </select>

      <button
        id="themeToggleBtn"
        class="theme-toggle"
         type="button"
         aria-label="Cambiar a modo oscuro"
         title="Cambiar tema"
        >🌙</button>
      <a href="#mochilita" title="Ver Mochilita" aria-label="Ver mi mochilita, carrito de compras" class="cart-link">
        <img src="Mochila.png" alt="" id="nav-img-mochila" class="cart-icon">
        <span id="cart-badge" aria-hidden="true" class="cart-badge u-hidden">0</span>
      </a>
      
      <label for="searchBox" class="sr-only">Buscar producto</label>
      <input type="text" id="searchBox" data-i18n-placeholder="nav.search" placeholder="Buscar producto..." oninput="filterProducts(this.value)" />
      
      <div id="auth-nav-container">
        <button class="btn secondary" onclick="abrirModalAuth('login')" data-i18n="nav.login">Iniciar Sesión</button>
      </div>
    </nav>
  </header>

  <a href="#app-content" class="skip-link">Saltar al contenido principal</a>

  <div id="app-content" tabindex="-1" class="app-content"></div>

  <footer class="footer-main">
    © <span id="year"></span> Papelería
  </footer>
</main>

<!-- ==================== MODALES ==================== -->

<div id="modalCantidad" class="modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="mc-title">
  <h3 id="mc-title">Cuantas unidades?</h3>
  <div class="qty-stepper">
    <button type="button" class="qty-btn" onclick="stepCantidad(-1)" aria-label="Disminuir cantidad">−</button>
    <label for="mc-cantidad" class="sr-only">Cantidad de unidades a agregar</label>
    <input id="mc-cantidad" class="qty-input" type="number" min="1" max="999" value="1" inputmode="numeric"
      oninput="this.value=this.value.replace(/[^0-9]/g,'');if(this.value<1)this.value=1;if(this.value.length>3)this.value=this.value.slice(0,3);" />
    <button type="button" class="qty-btn" onclick="stepCantidad(1)" aria-label="Aumentar cantidad">+</button>
  </div>
  <div class="actions">
   <button class="btn" onclick="confirmAddQuantity()" data-i18n="modals.add">Agregar</button>
   <button class="btn btn-cancel" onclick="closeModalCantidad()" data-i18n="modals.cancel">Cancelar</button>
  </div>
</div>

<div id="toast" class="toast">Agregado a tu mochilita</div>

<div id="modalTicket" class="modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="ticket-title">
  <h3 id="ticket-title">Ticket de compra</h3>
  <div id="ticketItems" class="ticket-items"></div>
  <p class="ticket-total">Total: $<span id="ticketTotal">0</span></p>
  <div class="u-text-center u-mt-md">Deseas recibir el ticket por correo?</div>
  <div class="u-flex-center u-gap-md u-mt-md">
    <button class="btn" onclick="showTicketEmailInput()">Si, enviarlo</button>
    <button class="btn btn-cancel" onclick="finishTicketWithoutEmail()">No, gracias</button>
  </div>
  <div id="ticketEmailRow" class="u-hidden u-mt-md">
    <label for="ticketEmailInput" class="sr-only">Correo electrónico para enviar el ticket</label>
    <input id="ticketEmailInput" type="email" placeholder="correo@ejemplo.com" class="form-input" />
    <div class="actions u-mt-md">
      <button class="btn" onclick="sendTicketByEmail()">Enviar</button>
      <button class="btn btn-cancel" onclick="closeModalTicket()">Cancelar</button>
    </div>
    <p id="ticketMsg" class="success-msg"></p>
  </div>
</div>

<!-- Modal 360 con animacion de giro -->
<div id="modal360" class="modal modal-wide" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="modal360Title">
  <h3 id="modal360Title">360 Viewer</h3>
  <div class="viewer360" id="viewer360">
    <div class="spin" id="viewerSpin">
      <img id="modal360Img" src="" alt="360 producto" draggable="false" />
    </div>
  </div>
  <div class="u-flex-center u-gap-md u-mt-md">
    <button class="btn" id="btnPlay360"  onclick="startSpin()" aria-pressed="true">Reproducir</button>
    <button class="btn secondary" id="btnPause360" onclick="stopSpin()" aria-pressed="false">Pausar</button>
    <button class="btn btn-cancel" onclick="closeModal360()" data-i18n="modals.close">Cerrar</button>
  </div>
  <p class="u-text-center u-text-sm u-text-muted">(Vista 360 provisional)</p>
</div>

<!-- Modal 360 con drag -->
<div id="viewer360Modal" onclick="close360View(event)">
  <img id="viewer360Img" src="" alt="Vista 360" class="viewer-grab">
</div>
<div id="modalAuth" class="modal modal-narrow" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Acceso a tu cuenta">
  
  <div id="auth-login-view">
   <h3 data-i18n="auth.login_title">Ingresar a tu Cuenta</h3>
   <label for="authLoginEmail" class="sr-only">Correo electrónico</label>
   <input id="authLoginEmail" type="email" data-i18n-placeholder="auth.email_placeholder" placeholder="Correo electrónico" class="form-input" />
  
   <label for="authLoginPass" class="sr-only">Contraseña</label>
   <div class="password-field">
     <input id="authLoginPass" type="password" data-i18n-placeholder="auth.pass_placeholder" placeholder="Contraseña" class="form-input" />
     <button type="button" class="password-toggle-btn" data-toggle-pass="authLoginPass" aria-label="Mostrar contraseña">
       <svg viewBox="0 0 24 24" aria-hidden="true">
         <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"/>
         <circle cx="12" cy="12" r="3"/>
         <line class="icon-slash" x1="3" y1="3" x2="21" y2="21"/>
       </svg>
     </button>
   </div>
  
   <button class="btn btn-block" onclick="ejecutarLoginPublico()" data-i18n="auth.login_btn">Iniciar Sesión</button>
  
   <p class="auth-switch">
    <span data-i18n="auth.no_account">¿No tienes cuenta?</span> <a href="#" class="auth-switch-link" onclick="event.preventDefault(); cambiarVistaAuth('registro')" data-i18n="auth.register_link">Regístrate aquí</a>
   </p>
  </div>

  <div id="auth-register-view" class="u-hidden">
    <h3 data-i18n="auth.register_title">Crear una Cuenta</h3>
    <label for="authRegNombre" class="sr-only">Nombre completo</label>
    <input id="authRegNombre" type="text" data-i18n-placeholder="auth.name_placeholder" placeholder="Nombre completo" class="form-input" />
    <label for="authRegEmail" class="sr-only">Correo electrónico</label>
    <input id="authRegEmail" type="email" data-i18n-placeholder="auth.email_placeholder" placeholder="Correo electrónico" class="form-input" />
    <label for="authRegPass" class="sr-only">Contraseña</label>
    <div class="password-field">
      <input id="authRegPass" type="password" minlength="8" data-i18n-placeholder="auth.reg_pass_placeholder" placeholder="Mínimo 8 caracteres, con letras y números" class="form-input" />
      <button type="button" class="password-toggle-btn" data-toggle-pass="authRegPass" aria-label="Mostrar contraseña">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"/>
          <circle cx="12" cy="12" r="3"/>
          <line class="icon-slash" x1="3" y1="3" x2="21" y2="21"/>
        </svg>
      </button>
    </div>
    <button class="btn btn-block" onclick="ejecutarRegistroPublico()" data-i18n="auth.register_btn">Registrarse</button>
    <p class="auth-switch">
      <span data-i18n="auth.has_account">¿Ya tienes cuenta?</span> <a href="#" class="auth-switch-link" onclick="event.preventDefault(); cambiarVistaAuth('login')" data-i18n="auth.login_link">Inicia sesión</a>
    </p>
  </div>

  <div class="actions u-mt-md">
    <button class="btn btn-cancel" onclick="cerrarModalAuth()" data-i18n="modals.close">Cerrar</button>
  </div>
  <p id="authModalMsg" class="form-msg is-error"></p>
</div>

<!-- Modal de Atajos de Teclado -->
<div id="modalShortcuts" class="modal modal-narrow" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="shortcutsTitle">
  <div class="u-flex-between u-mb-md">
    <h3 id="shortcutsTitle" class="u-no-margin" data-i18n="modals.shortcuts_title">Atajos de Teclado</h3>
    <kbd>?</kbd>
  </div>
  <ul class="shortcuts-list">
    <li class="u-flex-between">
      <span data-i18n="modals.short_search">Buscar producto</span> 
      <span><kbd>Ctrl</kbd> + <kbd>K</kbd></span>
    </li>
    <li class="u-flex-between">
      <span data-i18n="modals.short_cart">Ver Mochilita</span> 
      <kbd>M</kbd>
    </li>
    <li class="u-flex-between">
      <span data-i18n="modals.short_voice">Asistente de Voz</span> 
      <kbd>V</kbd>
    </li>
    <li class="u-flex-between">
      <span data-i18n="modals.short_close">Cerrar ventanas</span> 
      <kbd>Esc</kbd>
    </li>
  </ul>
  <div class="actions u-mt-md">
    <button class="btn btn-cancel btn-block" onclick="hideModal('modalShortcuts')" data-i18n="modals.close">Cerrar</button>
  </div>
</div>
<!-- Panel flotante del asistente -->
<div id="assistantBox" role="dialog" aria-label="Asistente El Profe" aria-hidden="true">
  <div class="mini-header">
    <h4 data-i18n="assistant.title">🤖 Asistente El Profe</h4>
    <button class="small-btn" id="assistantToggleBtn" aria-label="Cerrar asistente" data-i18n="assistant.close">✕</button>
  </div>
  <div id="assistantMessages" class="mini-body" role="log" aria-live="polite" aria-label="Conversación con el asistente"></div>
  <div id="assistantFooter" class="mini-footer">
    <label for="assistantInput" class="sr-only">Escribe tu pregunta para el asistente</label>
    <input type="text" id="assistantInput" data-i18n-placeholder="assistant.placeholder" placeholder="Escribe tu pregunta..." aria-label="Escribe tu pregunta" />
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