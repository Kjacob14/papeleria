/* ============================================================
   theme.js — Lógica de tema claro/oscuro, compartida entre
   index.php y admin.html (Fase 10).

   Antes esta lógica vivía duplicada como <script> inline en cada
   página. Se extrae aquí para que ambas usen exactamente el mismo
   comportamiento y no se desincronicen a futuro.

   Este archivo se carga en dos momentos distintos por diseño:

   1) aplicarTemaGuardado() debe ejecutarse en <head>, ANTES de que
      el navegador pinte el body, para evitar el parpadeo (FOUC) de
      cargar en claro y luego saltar a oscuro. Por eso el script que
      la invoca va inline y sin defer/async en el <head> de cada
      página.

   2) setupThemeToggle() se engancha a DOMContentLoaded y depende de
      que exista un botón con id="themeToggleBtn" en la página. Si
      la página no tiene ese botón (no debería pasar tras esta fase,
      pero por robustez) simplemente no hace nada.
============================================================ */

(function () {
  function aplicarTemaGuardado() {
    var guardado = localStorage.getItem('tema');
    if (guardado === 'dark' || guardado === 'light') {
      document.documentElement.setAttribute('data-theme', guardado);
    }
    // Si no hay preferencia guardada, no se setea nada: manda
    // @media (prefers-color-scheme) definido en styles.css.
  }

  function esOscuroActual() {
    var actual = document.documentElement.getAttribute('data-theme');
    return actual === 'dark'
      || (!actual && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function aplicarIconoTema() {
    var btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    var oscuro = esOscuroActual();
    btn.textContent = oscuro ? '☀️' : '🌙';
    btn.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }

  function toggleTema() {
    var nuevo = esOscuroActual() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    localStorage.setItem('tema', nuevo);
    aplicarIconoTema();
  }

  function setupThemeToggle() {
    var btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    btn.addEventListener('click', toggleTema);
    aplicarIconoTema();
  }

  // Se ejecuta de inmediato: este archivo se carga en <head> sin
  // defer/async precisamente para que esto corra antes del primer
  // paint y no haya parpadeo de tema.
  aplicarTemaGuardado();

  document.addEventListener('DOMContentLoaded', setupThemeToggle);

  // Expuesto por si se necesita disparar el cambio de tema desde
  // otro script. El botón #themeToggleBtn NO debe llevar además un
  // onclick="toggleTema()" en el HTML: setupThemeToggle() ya le
  // agrega su propio listener, y tener ambos causa que un solo clic
  // dispare el toggle dos veces (cambia de tema y vuelve de
  // inmediato al original — parece que el botón "no hace nada").
  window.toggleTema = toggleTema;
})();

/* ============================================================
   Toggle mostrar/ocultar contraseña — compartido entre
   admin.html e index.php (login y registro).

   Un solo ícono de ojo en SVG (trazo delgado, sin relleno) que
   combina con el resto del sistema de diseño en vez de un emoji.
   El "ojo tachado" es el mismo SVG con una línea diagonal extra
   que se muestra u oculta con la clase .is-visible — no se
   intercambian ícono por ícono.

   Cualquier botón con [data-toggle-pass="idDelInput"] se conecta
   automáticamente al cargar la página, así no hace falta repetir
   la función para loginPass, authLoginPass y authRegPass.
============================================================ */
function setupPasswordToggles() {
  document.querySelectorAll('[data-toggle-pass]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const input = document.getElementById(btn.getAttribute('data-toggle-pass'));
      if (!input) return;
      const oculto = input.type === 'password';
      input.type = oculto ? 'text' : 'password';
      btn.classList.toggle('is-visible', oculto);
      btn.setAttribute('aria-label', oculto ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });
}

document.addEventListener('DOMContentLoaded', setupPasswordToggles);