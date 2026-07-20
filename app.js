/* ============================================================
   Papelería El Profe — app.js
============================================================ */

emailjs.init("Rz7f3kZkPxlwT1bL0");

/* ── Helpers de API ──────────────────────────────────────── */
const API = 'api.php';

/**
 * Fase 3: el backend ahora responde con códigos HTTP reales (400,
 * 401, 404, 409, etc.) además del 200. Antes, cualquier código
 * distinto de 2xx hacía throw sin leer el cuerpo, así que mensajes
 * como "Correo o contraseña incorrectos" nunca llegaban a mostrarse
 * (el usuario solo veía "Error de conexión con el servidor").
 *
 * Ahora: siempre se intenta leer el JSON de la respuesta, sin
 * importar el código HTTP. El JSON del backend siempre trae
 * { ok: true/false, error?: '...' }, así que quien llama a apiGet/
 * apiPost puede seguir revisando data.ok / data.error exactamente
 * igual que antes.
 *
 * Solo se lanza una excepción real (catch) cuando la respuesta NO
 * se puede interpretar como JSON — eso sí es un fallo de conexión
 * genuino (servidor caído, XAMPP apagado, etc.), no un error de
 * validación esperado.
 */
async function apiGet(action) {
  const res = await fetch(`${API}?action=${action}`);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`HTTP ${res.status}`);
  }
  return data;
}

async function apiPost(action, data) {
  const res = await fetch(`${API}?action=${action}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error(`HTTP ${res.status}`);
  }
  return json;
}

/* ── Carga de datos ──────────────────────────────────────── */
async function loadProducts() {
  try {
    return await apiGet('productos');
  } catch (e) {
    console.error('Error cargando productos desde la BD:', e.message);
    showToast('⚠️ No se pudo conectar con la base de datos. Verifica que XAMPP esté activo.');
    return [];
  }
}

async function loadCombos() {
  try { return await apiGet('combos'); }
  catch (e) { console.warn('API de combos no disponible:', e.message); return []; }
}

async function loadOrders() {
  try { return await apiGet('pedidos'); }
  catch (e) { console.warn('loadOrders:', e.message); return []; }
}

function saveOrder(order) {
  return apiPost('guardar_pedido', order);
}

/* ── Estado global ───────────────────────────────────────── */
let products = [];
let combos   = [];
let orders   = [];
let cart     = [];
let productToAddIndex  = null;
let editingProductIndex = null;
let usuarioActivo = null;

/* ── AUTENTICACIÓN ───────────────────────────────────────── */
function abrirModalAuth(vista = 'login') {
  document.getElementById('authModalMsg').style.display = 'none';
  cambiarVistaAuth(vista);
  showModal('modalAuth');
}

function cerrarModalAuth() { hideModal('modalAuth'); }

function cambiarVistaAuth(vista) {
  document.getElementById('auth-login-view').style.display    = vista === 'login' ? 'block' : 'none';
  document.getElementById('auth-register-view').style.display = vista === 'registro' ? 'block' : 'none';
  document.getElementById('authModalMsg').style.display = 'none';
}

async function ejecutarLoginPublico() {
  const correo = document.getElementById('authLoginEmail').value.trim();
  const pass   = document.getElementById('authLoginPass').value.trim();
  const msg    = document.getElementById('authModalMsg');

  if (!correo || !pass) { msg.textContent = 'Completa todos los campos.'; msg.style.display = 'block'; return; }

  try {
    const data = await apiPost('login', { correo, contrasena: pass });
    if (data.ok) {
      if (data.rol === 'admin') { window.location.href = 'admin.html'; return; }
      usuarioActivo = { id: data.id, nombre: data.nombre, rol: data.rol };
      cerrarModalAuth();
      actualizarNavbarUsuario();
      showToast(`¡Bienvenido de nuevo, ${data.nombre}! 👋`);
    } else {
      msg.textContent = data.error || 'Credenciales incorrectas.';
      msg.style.display = 'block';
    }
  } catch (e) {
    msg.textContent = 'Error de conexión con el servidor.';
    msg.style.display = 'block';
  }
}

async function ejecutarRegistroPublico() {
  const nombre = document.getElementById('authRegNombre').value.trim();
  const correo = document.getElementById('authRegEmail').value.trim();
  const pass   = document.getElementById('authRegPass').value.trim();
  const msg    = document.getElementById('authModalMsg');

  if (!nombre || !correo || !pass) { msg.textContent = 'Completa todos los campos.'; msg.style.display = 'block'; return; }

  try {
    const data = await apiPost('crear_cuenta', { nombre, correo, contrasena: pass });
    if (data.ok) {
      msg.style.color = 'var(--success)';
      msg.textContent = '¡Cuenta creada! Iniciando sesión...';
      msg.style.display = 'block';
      setTimeout(async () => {
        const loginData = await apiPost('login', { correo, contrasena: pass });
        if (loginData.ok) {
          usuarioActivo = { id: loginData.id, nombre: loginData.nombre, rol: loginData.rol };
          cerrarModalAuth();
          actualizarNavbarUsuario();
          showToast(`¡Bienvenido ${loginData.nombre}!`);
        }
      }, 1200);
    } else {
      msg.style.color = 'var(--danger)';
      msg.textContent = data.error || 'Error al crear la cuenta.';
      msg.style.display = 'block';
    }
  } catch (e) {
    msg.style.color = 'var(--danger)';
    msg.textContent = 'Error de conexión.';
    msg.style.display = 'block';
  }
}

function actualizarNavbarUsuario() {
  const container = document.getElementById('auth-nav-container');
  if (!container) return;
  if (usuarioActivo) {
    container.innerHTML = `
      <span style="font-weight:700; margin-right:10px; color:var(--text);">Hola, ${escapeHtml(usuarioActivo.nombre.split(' ')[0])}</span>
      <button class="btn danger" style="padding:4px 10px; font-size:13px;" onclick="cerrarSesionPublica()">Salir</button>`;
  } else {
    container.innerHTML = `<button class="btn secondary" onclick="abrirModalAuth('login')">Iniciar Sesión</button>`;
  }
}

function cerrarSesionPublica() {
  usuarioActivo = null;
  actualizarNavbarUsuario();
  showToast('Has cerrado sesión.');
  window.location.hash = '#inicio';
}

/* ── BADGE MOCHILITA ─────────────────────────────────────── */
function actualizarBadgeMochilita() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const total = cart.reduce((sum, item) => sum + item.cantidad, 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? 'block' : 'none';
}

/* ── HELPERS ─────────────────────────────────────────────── */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

/* ── RENDER CATÁLOGO ─────────────────────────────────────── */
function renderCatalog(customList = null) {
  const list = customList || products;
  const container = document.getElementById('catalogo');
  if (!container) return;
  container.innerHTML = '';

  list.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'item';

    const variantesHTML = (() => {
      if (!p.variantes) return '';
      return Object.entries(p.variantes).map(([key, vals]) => `
        <div style="margin-top:6px;">
          <label style="font-size:12px;font-weight:700;">${escapeHtml(key)}:</label>
          <select class="variant-select" data-key="${escapeHtml(key)}" style="margin-left:4px;font-size:12px;">
            ${vals.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
          </select>
        </div>`).join('');
    })();

    div.innerHTML = `
      <img class="thumb" src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}" loading="lazy" />
      <div class="item-info">
        <h3 style="margin-top:10px;font-size:15px;">${escapeHtml(p.nombre)}</h3>
        <div class="price" style="font-size:18px;margin:8px 0;">$${Number(p.precio).toFixed(2)}</div>
        <div style="font-size:12px;color:var(--text-muted);">Stock: ${p.stock ?? 0}</div>
        ${variantesHTML}
      </div>
      <div style="display:flex;gap:6px;justify-content:center;margin-top:8px;">
        <button class="btn" onclick="openModalCantidad(${i})" ${p.stock <= 0 ? 'disabled' : ''}>
          ${p.stock <= 0 ? 'Sin stock' : 'Agregar'}
        </button>
        <button class="btn secondary" style="padding:8px 10px;font-size:13px;" onclick="openModal360('${escapeHtml(p.imagen)}','${escapeHtml(p.nombre)}')">Ver 360°</button>
      </div>`;
    container.appendChild(div);
  });
}

/* ── RENDER CARRITO ──────────────────────────────────────── */
function renderCart() {
  actualizarBadgeMochilita();
  const lista   = document.getElementById('listaMochilita');
  const mensaje = document.getElementById('mensajeCarrito');
  const total   = document.getElementById('totalCarrito');
  if (!lista) return;

  lista.innerHTML = '';

  if (cart.length === 0) {
    if (mensaje) mensaje.style.display = 'block';
    if (total)   total.textContent = 'Total: $0.00';
    return;
  }

  if (mensaje) mensaje.style.display = 'none';
  let sum = 0;

  cart.forEach((item, i) => {
    sum += item.precio * item.cantidad;
    const li = document.createElement('li');
    li.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);';
    li.innerHTML = `
      <span>${escapeHtml(item.nombre)} x${item.cantidad} — $${(item.precio * item.cantidad).toFixed(2)}</span>
      <span style="display:flex;gap:4px;">
        <button class="btn" style="padding:2px 8px;" onclick="changeQuantity(${i},-1)">−</button>
        <button class="btn" style="padding:2px 8px;" onclick="changeQuantity(${i}, 1)">+</button>
        <button class="btn btn-cancel" style="padding:2px 8px;" onclick="removeItem(${i})">✕</button>
      </span>`;
    lista.appendChild(li);
  });

  if (total) total.textContent = `Total: $${sum.toFixed(2)}`;
}

/* ── COMBOS ──────────────────────────────────────────────── */
function agregarCombo(id, nombre, precio) {
  const existe = cart.find(i => i.id === id && i.tipo === 'Combo');
  if (existe) existe.cantidad += 1;
  else cart.push({ id, nombre, precio: Number(precio), cantidad: 1, tipo: 'Combo' });
  actualizarBadgeMochilita();
  showToast(`¡${nombre} agregado a tu mochilita! 🎒`);
}

function buildComboCard(c) {
  const etiquetaHTML = c.etiqueta
    ? `<div style="position:absolute;top:-10px;right:-10px;background:var(--accent);color:var(--on-accent);padding:4px 10px;border-radius:12px;font-weight:bold;font-size:12px;box-shadow:0 2px 5px rgba(0,0,0,0.2);z-index:2;">${escapeHtml(c.etiqueta)}</div>`
    : '';
  return `
    <div class="item" style="border:2px solid var(--accent);position:relative;background:var(--surface);flex:0 0 auto;width:280px;scroll-snap-align:center;">
      ${etiquetaHTML}
      <img class="thumb" src="${escapeHtml(c.imagen)}" alt="${escapeHtml(c.nombre)}" style="height:150px;object-fit:contain;" loading="lazy" />
      <h3 style="margin-top:10px;">${escapeHtml(c.nombre)}</h3>
      <p style="font-size:13px;color:var(--text-muted);padding:0 10px;">${escapeHtml(c.descripcion)}</p>
      <div class="price" style="font-size:18px;margin:8px 0;">$${Number(c.precio).toFixed(2)}</div>
      <div class="actions">
        <button class="btn" onclick="agregarCombo(${c.id},'${escapeHtml(c.nombre)}',${c.precio})">Agregar a Mochilita</button>
      </div>
    </div>`;
}

function setupCarousel(sliderId) {
  const slider = document.getElementById(sliderId);
  if (!slider || slider.children.length === 0) return;

  let isDown = false, startX = 0, scrollLeft = 0;
  let autoPlay = setInterval(tick, 3000);

  function tick() {
    if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 10) {
      slider.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      slider.scrollBy({ left: 296, behavior: 'smooth' });
    }
  }

  slider.addEventListener('mouseenter',  () => clearInterval(autoPlay));
  slider.addEventListener('mouseleave',  () => { isDown = false; clearInterval(autoPlay); autoPlay = setInterval(tick, 3000); });
  slider.addEventListener('mousedown',   e  => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; clearInterval(autoPlay); });
  slider.addEventListener('mouseup',     ()  => { isDown = false; clearInterval(autoPlay); autoPlay = setInterval(tick, 3000); });
  slider.addEventListener('mousemove',   e  => {
    if (!isDown) return;
    e.preventDefault();
    slider.scrollLeft = scrollLeft - (e.pageX - slider.offsetLeft - startX) * 2;
  });
}

/* ── MODAL CANTIDAD ──────────────────────────────────────── */
function openModalCantidad(index) {
  const p = products[index];
  if (!p || p.stock <= 0) { showToast('Sin stock disponible'); return; }
  productToAddIndex = index;
  document.getElementById('mc-title').textContent = `¿Cuántas unidades de "${p.nombre}"?`;
  document.getElementById('mc-cantidad').value = 1;
  document.getElementById('mc-cantidad').max = p.stock;
  showModal('modalCantidad');
}

function closeModalCantidad() { hideModal('modalCantidad'); }

function confirmAddQuantity() {
  if (productToAddIndex === null) return;
  const p        = products[productToAddIndex];
  const cantidad = parseInt(document.getElementById('mc-cantidad').value) || 1;

  if (cantidad < 1 || cantidad > p.stock) {
    showToast(`Solo hay ${p.stock} unidades disponibles.`); return;
  }

  const existe = cart.find(i => i.id === p.id && i.tipo === '');
  if (existe) existe.cantidad += cantidad;
  else cart.push({ id: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad, tipo: '' });

  p.stock -= cantidad;
  renderCatalog();
  renderCart();
  hideModal('modalCantidad');
  showToast(`${cantidad} × ${p.nombre} añadido(s) a tu mochilita`);
}

function removeItem(index) {
  const item    = cart[index];
  const product = products.find(p => p.id === item.id);
  if (product && item.tipo !== 'Combo') product.stock += item.cantidad;
  cart.splice(index, 1);
  renderCatalog();
  renderCart();
  showToast(`${item.nombre} eliminado de la mochilita.`);
}

function changeQuantity(index, delta) {
  const item    = cart[index];
  const product = products.find(p => p.id === item.id);

  if (delta > 0 && product && product.stock <= 0 && item.tipo !== 'Combo') {
    showToast(`Ya no hay más unidades de ${item.nombre}.`); return;
  }

  if (delta > 0) {
    item.cantidad++;
    if (product && item.tipo !== 'Combo') product.stock--;
  } else {
    item.cantidad--;
    if (product && item.tipo !== 'Combo') product.stock++;
    if (item.cantidad <= 0) {
      cart.splice(index, 1);
      showToast(`${item.nombre} eliminado.`);
    }
  }

  renderCatalog();
  renderCart();
}

function filterProducts(query) {
  const q = query.toLowerCase().trim();
  if (!q) { renderCatalog(); return; }
  renderCatalog(products.filter(p => p.nombre.toLowerCase().includes(q)));
}

/* ── TOAST ───────────────────────────────────────────────── */
let toastTimer = null;
function showToast(msg = 'Hecho', ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  t.classList.remove('hide');
  t.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.add('hide');
    t.classList.remove('show');
    setTimeout(() => t.style.display = 'none', 360);
  }, ms);
}

/* ── TICKET / PEDIDOS ────────────────────────────────────── */
function openTicketModal(metodoPago = "No especificado") {
  const resumen = cart.map(p => `${p.nombre} x${p.cantidad} — $${(p.precio * p.cantidad).toFixed(2)}`).join('<br>');
  const total   = cart.reduce((t, p) => t + p.precio * p.cantidad, 0).toFixed(2);
  let extraHTML = '';

  if (metodoPago === "Efectivo")             extraHTML = `<p style="margin-top:15px;">Cliente pagará en efectivo</p>`;
  else if (metodoPago === "Tarjeta")         extraHTML = `<p style="margin-top:15px;">Pago con tarjeta de crédito</p>`;
  else if (metodoPago === "Transferencia")   extraHTML = `<p style="margin-top:15px;">Transferencia bancaria<br>Banco: BBVA | Cuenta: 1234 5678 9012 | CLABE: 012345678901234567</p>`;

  document.getElementById('ticketItems').innerHTML = resumen + extraHTML;
  document.getElementById('ticketTotal').textContent = total;
  document.getElementById('ticketEmailRow').style.display = 'none';
  document.getElementById('ticketMsg').textContent = '';
  showModal('modalTicket');
}

function showTicketEmailInput() { document.getElementById('ticketEmailRow').style.display = 'block'; }
function closeModalTicket()     { hideModal('modalTicket'); }

async function finishTicketWithoutEmail() {
  const id    = 'PED-' + Date.now();
  const items = cart.map(i => `${i.nombre} x${i.cantidad} - $${(i.precio*i.cantidad).toFixed(2)}`).join('; ');
  const total = cart.reduce((s, i) => s + i.precio * i.cantidad, 0).toFixed(2);
  const order = { id, fecha: new Date().toLocaleString(), items, total, correo: '', carrito: cart };

  // Fase 3: el backend ahora valida stock y precios estrictamente y
  // puede rechazar el pedido (ej. alguien más compró el último
  // artículo mientras estaba en el carrito). Antes esto casi no se
  // detectaba; ahora hay que revisar data.ok en vez de asumir éxito.
  let data;
  try {
    data = await apiPost('guardar_pedido', order);
  } catch (e) {
    console.warn('Error de conexión guardando pedido:', e);
    showToast('⚠️ No se pudo conectar con el servidor. Intenta de nuevo.');
    return;
  }

  if (!data.ok) {
    showToast(`⚠️ No se pudo registrar el pedido: ${data.error || 'error desconocido'}`);
    return;
  }

  showToast('Pedido registrado con éxito');
  cart = [];
  hideModal('modalTicket');
  renderCart();
  products = await loadProducts();
  if (window.location.hash === '#catalogo') renderCatalog();
}

async function sendTicketByEmail() {
  const correo = document.getElementById('ticketEmailInput').value.trim();
  if (!correo) { alert('Ingresa un correo válido'); return; }

  let texto = 'Ticket de compra - Papelería El Profe\n\n';
  let total  = 0;
  cart.forEach(it => {
    texto += `${it.nombre} x${it.cantidad} - $${(it.precio*it.cantidad).toFixed(2)}\n`;
    total += it.precio * it.cantidad;
  });
  texto += `\nTotal: $${total.toFixed(2)}\n`;

  try {
    await emailjs.send("service_8ijihn6", "template_us81s2k", { to_email: correo, message: texto });
    showToast(`Ticket enviado a ${correo}`);
  } catch (err) {
    console.error(err);
    alert('Error al enviar correo. Pedido guardado igualmente.');
  }

  const id    = 'PED-' + Date.now();
  const items = cart.map(i => `${i.nombre} x${i.cantidad} - $${(i.precio*i.cantidad).toFixed(2)}`).join('; ');
  const order = { id, fecha: new Date().toLocaleString(), items, total: total.toFixed(2), correo, carrito: cart };

  // Fase 3: mismo cuidado que en finishTicketWithoutEmail — el correo
  // ya se envió (o se intentó) arriba, pero el pedido en sí puede ser
  // rechazado por el backend (stock insuficiente, producto eliminado,
  // etc.). Se informa al usuario en vez de asumir éxito silencioso.
  let data;
  try {
    data = await apiPost('guardar_pedido', order);
  } catch (e) {
    console.warn('Error de conexión guardando pedido:', e);
    showToast('⚠️ Ticket enviado, pero no se pudo conectar con el servidor para registrar el pedido.');
    cart = [];
    hideModal('modalTicket');
    renderCart();
    return;
  }

  if (!data.ok) {
    showToast(`⚠️ Ticket enviado, pero el pedido no se pudo registrar: ${data.error || 'error desconocido'}`);
    cart = [];
    hideModal('modalTicket');
    renderCart();
    return;
  }

  cart = [];
  hideModal('modalTicket');
  renderCart();
  products = await loadProducts();
  if (window.location.hash === '#catalogo') renderCatalog();
}

/* ── CONFIRMAR PEDIDO ────────────────────────────────────── */
/**
 * Fase 6: estos dos diálogos se armaban con document.createElement
 * fuera del sistema de modales — sin overlay, sin role="dialog", sin
 * foco gestionado y sin cierre por Escape. crearDialogoFlotante()
 * centraliza eso reutilizando la misma trampa de foco/Escape que ya
 * usan showModal/hideModal, para que el comportamiento de teclado
 * sea idéntico en todo el sitio.
 */
function crearDialogoFlotante(etiqueta, innerHTML) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.35)',
    zIndex: '2000', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  const box = document.createElement('div');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', etiqueta);
  Object.assign(box.style, {
    background: 'var(--surface)', padding: '25px', borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)', textAlign: 'center', maxWidth: '90%',
  });
  box.innerHTML = innerHTML;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const elementoPrevio = document.activeElement;
  const focusables = getFocusablesEnModal(box);
  if (focusables.length > 0) focusables[0].focus();

  function manejarTecla(e) {
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
    if (e.key === 'Tab') {
      const f = getFocusablesEnModal(box);
      if (f.length === 0) return;
      const primero = f[0], ultimo = f[f.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    }
  }
  document.addEventListener('keydown', manejarTecla);

  function cerrar() {
    document.removeEventListener('keydown', manejarTecla);
    document.body.removeChild(overlay);
    if (elementoPrevio && typeof elementoPrevio.focus === 'function') elementoPrevio.focus();
  }

  return { box, cerrar };
}

function confirmarPedido() {
  if (cart.length === 0) { showToast("Tu mochilita está vacía 👜"); return; }

  const { box, cerrar } = crearDialogoFlotante('Confirmar pedido', `
    <h3 style="margin-bottom:10px;">¿Confirmar pedido? 🛍️</h3>
    <p>Total: <b>$${cart.reduce((t,p)=>t+p.precio*p.cantidad,0).toFixed(2)}</b></p>
    <div style="margin-top:15px;display:flex;justify-content:center;gap:10px;">
      <button id="confirmYes" class="btn">Sí, confirmar</button>
      <button id="confirmNo"  class="btn secondary">Cancelar</button>
    </div>`);

  box.querySelector('#confirmYes').onclick = () => { cerrar(); seleccionarMetodoPago(); };
  box.querySelector('#confirmNo').onclick  = () => { cerrar(); showToast("Pedido cancelado"); };
}

function seleccionarMetodoPago() {
  const { box, cerrar } = crearDialogoFlotante('Método de pago', `
    <h3 style="margin-bottom:15px;">Método de pago 💳</h3>
    <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
      <button class="btn" id="pagoEfectivo">Efectivo</button>
      <button class="btn" id="pagoTarjeta">Tarjeta</button>
      <button class="btn" id="pagoTransferencia">Transferencia</button>
    </div>
    <button class="btn btn-cancel" id="pagoCancel" style="margin-top:14px;">Cancelar</button>`);

  box.querySelector('#pagoEfectivo').onclick      = () => { cerrar(); openTicketModal("Efectivo"); };
  box.querySelector('#pagoTarjeta').onclick       = () => { cerrar(); openTicketModal("Tarjeta"); };
  box.querySelector('#pagoTransferencia').onclick = () => { cerrar(); openTicketModal("Transferencia"); };
  box.querySelector('#pagoCancel').onclick        = () => { cerrar(); showToast("Pago cancelado"); };
}

/* ── MODAL HELPERS (accesibles) ──────────────────────────────
 * Fase 6: antes solo alternaban 'display' y un aria-hidden estático.
 * Un usuario de teclado o de lector de pantalla podía:
 *   - quedar navegando "detrás" del modal (el foco nunca se movía
 *     adentro al abrir),
 *   - tabular fuera del modal hacia elementos ocultos detrás,
 *   - no tener forma de cerrar con Escape,
 *   - perder su posición original al cerrar (el foco no regresaba
 *     al botón que abrió el modal).
 * Ahora: al abrir, se guarda el elemento que tenía el foco, se marca
 * el modal con role="dialog" + aria-modal="true", se mueve el foco
 * al primer elemento enfocable de adentro, se atrapa Tab/Shift+Tab
 * dentro del modal, y Escape cierra. Al cerrar, se libera todo eso y
 * el foco regresa a quien abrió el modal.
 */
let elementoAntesDelModal = null;
let modalActivoId = null;

function getFocusablesEnModal(modalEl) {
  return Array.from(modalEl.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null);
}

function manejarTeclaModal(e) {
  if (!modalActivoId) return;
  const modal = document.getElementById(modalActivoId);
  if (!modal) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    hideModal(modalActivoId);
    return;
  }

  if (e.key === 'Tab') {
    const focusables = getFocusablesEnModal(modal);
    if (focusables.length === 0) return;
    const primero = focusables[0];
    const ultimo  = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }
}

function showModal(id) {
  const el = document.getElementById(id);
  if (!el) return;

  elementoAntesDelModal = document.activeElement;
  modalActivoId = id;

  el.style.display = 'block';
  el.setAttribute('aria-hidden', 'false');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');

  const focusables = getFocusablesEnModal(el);
  if (focusables.length > 0) focusables[0].focus();
  else el.setAttribute('tabindex', '-1'), el.focus();

  document.addEventListener('keydown', manejarTeclaModal);
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');

  if (modalActivoId === id) {
    document.removeEventListener('keydown', manejarTeclaModal);
    modalActivoId = null;
    if (elementoAntesDelModal && typeof elementoAntesDelModal.focus === 'function') {
      elementoAntesDelModal.focus();
    }
    elementoAntesDelModal = null;
  }
}

/* ── VIEWER 360° ─────────────────────────────────────────── */
function openModal360(url, title) {
  document.getElementById('modal360Img').src = url || '';
  document.getElementById('modal360Title').textContent = `360°: ${title || ''}`;
  document.getElementById('viewer360').classList.add('spin-anim');
  showModal('modal360');
}
function closeModal360() { document.getElementById('viewer360').classList.remove('spin-anim'); hideModal('modal360'); }
function startSpin()     {
  document.getElementById('viewer360').classList.add('spin-anim');
  document.getElementById('btnPlay360').setAttribute('aria-pressed', 'true');
  document.getElementById('btnPause360').setAttribute('aria-pressed', 'false');
}
function stopSpin()      {
  document.getElementById('viewer360').classList.remove('spin-anim');
  document.getElementById('btnPlay360').setAttribute('aria-pressed', 'false');
  document.getElementById('btnPause360').setAttribute('aria-pressed', 'true');
}

function close360View(e) {
  if (e.target.id === 'viewer360Modal')
    document.getElementById('viewer360Modal').classList.remove('active');
}

/* ── ASISTENTE VIRTUAL ───────────────────────────────────── */
function speakText(text) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-MX'; u.rate = 1; u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

let recognition = null, recognizing = false;

function setupSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'es-MX';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart  = () => { recognizing = true;  const b = document.getElementById('assistantVoiceBtn'); b.textContent = '🎙️...'; b.setAttribute('aria-pressed', 'true'); };
  recognition.onend    = () => { recognizing = false; const b = document.getElementById('assistantVoiceBtn'); b.textContent = '🎤'; b.setAttribute('aria-pressed', 'false'); };
  recognition.onerror  = ()  => { recognizing = false; const b = document.getElementById('assistantVoiceBtn'); b.textContent = '🎤'; b.setAttribute('aria-pressed', 'false'); };
  recognition.onresult = ev  => {
    const t = (ev.results[0][0].transcript || '').trim();
    addAssistantUserMessage(t);
    processAssistantMessage(t);
  };
}

function addAssistantUserMessage(text) {
  const d = document.createElement('div');
  d.className = 'assistant-msg assistant-user';
  d.textContent = text;
  const msgs = document.getElementById('assistantMessages');
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function addAssistantBotMessage(text) {
  const d = document.createElement('div');
  d.className = 'assistant-msg assistant-bot';
  d.textContent = text;
  const msgs = document.getElementById('assistantMessages');
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function processAssistantMessage(msg) {
  const lower    = msg.toLowerCase().trim();
  const numMatch = lower.match(/\d+/);
  const cantidad = numMatch ? parseInt(numMatch[0]) : 1;

  const addWords    = ["agrega","añade","pon","mete","quiero","agregar"];
  const searchWords = ["buscar","tienes","hay","mostrar","ver","muéstrame"];
  const isAdd    = addWords.some(w => lower.includes(w));
  const isSearch = searchWords.some(w => lower.includes(w));

  const matches = products.filter(p =>
    lower.includes(p.nombre.toLowerCase().split(" ")[0]) ||
    p.nombre.toLowerCase().includes(lower)
  );

  if (isAdd && matches.length > 0) {
    const prod = matches[0];
    const cant = Math.min(cantidad, prod.stock);
    if (cant <= 0) {
      const r = `No quedan unidades de ${prod.nombre}`;
      addAssistantBotMessage(r); speakText(r); return;
    }
    const existe = cart.find(i => i.id === prod.id && i.tipo === '');
    if (existe) existe.cantidad += cant;
    else cart.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: cant, tipo: '' });
    prod.stock -= cant;
    renderCatalog(); renderCart();
    const r = `${cant} ${prod.nombre} agregado(s) a tu mochilita`;
    addAssistantBotMessage(r); speakText(r); return;
  }

  if (isSearch || matches.length > 0) {
    if (matches.length > 0) {
      let r = "Encontré estos productos:\n";
      matches.forEach(p => { r += `• ${p.nombre} — $${p.precio} (${p.stock} disponibles)\n`; });
      addAssistantBotMessage(r); speakText(r);
    } else {
      const r = "No encontré ese producto.";
      addAssistantBotMessage(r); speakText(r);
    }
    return;
  }

  const rules = [
    { keywords: ["hola","buenas","hey"],          reply: "¡Hola! ¿En qué te ayudo hoy?" },
    { keywords: ["precio","cuesta","valor"],       reply: "Puedo consultar precios. ¿De qué producto?" },
    { keywords: ["horario","hora","abierto"],      reply: "Lun-Vie 7:00-22:00 • Sáb-Dom 10:00-21:30" },
    { keywords: ["dirección","dónde","ubicación"], reply: "Av. Rincón del álamo, Villa de Almoloya de Juárez, México" },
    { keywords: ["teléfono","tel","número"],       reply: "Tel: 722-518-1849" },
    { keywords: ["gracias","thank"],              reply: "¡Con gusto! 😊" },
    { keywords: ["pedido","carrito","mochilita"], reply: `Tienes ${cart.reduce((s,i)=>s+i.cantidad,0)} artículo(s) en tu mochilita.` },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => lower.includes(k))) {
      addAssistantBotMessage(rule.reply); speakText(rule.reply); return;
    }
  }

  const fallback = "No entendí muy bien 🤔 ¿Podrías repetirlo?";
  addAssistantBotMessage(fallback); speakText(fallback);
}

/* ── SETUP ───────────────────────────────────────────────── */
function setupFloatingButtons() {
  document.getElementById('chatbotBtn').addEventListener('click', () => {
    const box  = document.getElementById('assistantBox');
    const btn  = document.getElementById('chatbotBtn');
    const visible = box.style.display === 'flex';
    box.style.display = visible ? 'none' : 'flex';
    box.setAttribute('aria-hidden', String(visible));
    btn.setAttribute('aria-expanded', String(!visible));
    if (!visible) document.getElementById('assistantInput').focus();
  });

  document.getElementById('voiceBtn').addEventListener('click', () => {
    const box = document.getElementById('assistantBox');
    box.style.display = 'flex';
    box.setAttribute('aria-hidden', 'false');
    document.getElementById('chatbotBtn').setAttribute('aria-expanded', 'true');
    const voiceBtn = document.getElementById('voiceBtn');
    if (!recognition) { addAssistantBotMessage('Tu navegador no soporta reconocimiento de voz.'); return; }
    if (recognizing) { recognition.stop(); voiceBtn.setAttribute('aria-pressed', 'false'); showToast('Grabación detenida'); }
    else             { recognition.start(); voiceBtn.setAttribute('aria-pressed', 'true'); showToast('Escuchando... 🎤'); }
  });
}

function setupAssistantBox() {
  document.getElementById('assistantToggleBtn').addEventListener('click', () => {
    const box = document.getElementById('assistantBox');
    box.style.display = 'none';
    box.setAttribute('aria-hidden', 'true');
    document.getElementById('chatbotBtn').setAttribute('aria-expanded', 'false');
  });
  document.getElementById('assistantVoiceBtn').addEventListener('click', () => {
    if (!recognition) { addAssistantBotMessage('Sin soporte de voz.'); return; }
    if (recognizing) recognition.stop();
    else             recognition.start();
  });
  document.getElementById('assistantSendBtn').addEventListener('click', () => {
    const txt = document.getElementById('assistantInput').value.trim();
    if (!txt) return;
    addAssistantUserMessage(txt);
    document.getElementById('assistantInput').value = '';
    processAssistantMessage(txt);
  });
  document.getElementById('assistantInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('assistantSendBtn').click();
  });
}

let isDragging = false, startX360 = 0, currentRotation = 0;
function setupViewerDrag() {
  const img = document.getElementById('viewer360Img');
  if (!img) return;
  img.addEventListener('mousedown',  e => { isDragging = true;  startX360 = e.clientX; img.style.cursor = 'grabbing'; });
  img.addEventListener('mouseup',    () => { isDragging = false; img.style.cursor = 'grab'; });
  img.addEventListener('mouseleave', () => { isDragging = false; });
  img.addEventListener('mousemove',  e => {
    if (!isDragging) return;
    currentRotation += (e.clientX - startX360) * 0.4;
    startX360 = e.clientX;
    img.style.transform = `rotateY(${currentRotation}deg)`;
  });
}

/* ── INDICADOR DE SECCIÓN ACTIVA ────────────────────────── */
function updateNavActive(hash) {
  document.querySelectorAll('.nav-right a[href]').forEach(a => {
    const isActive = a.getAttribute('href') === hash;
    a.style.borderBottom  = isActive ? '2px solid var(--accent-dark)' : '2px solid transparent';
    a.style.paddingBottom = '2px';
    a.style.color         = isActive ? 'var(--accent-dark)' : '';
  });
  const mochilaLink = document.querySelector('a[href="#mochilita"]');
  if (mochilaLink) {
    mochilaLink.style.filter = hash === '#mochilita' ? 'drop-shadow(0 0 5px #F1A0B6)' : '';
  }
}

/* ── ROUTER SPA ──────────────────────────────────────────── */
function router() {
  const hash       = window.location.hash || '#inicio';
  const appContent = document.getElementById('app-content');
  appContent.innerHTML = '';
  updateNavActive(hash);

  /* ── INICIO ── */
  if (hash === '#inicio') {
    const popularKeywords = ['lapicero','cuaderno','lápiz','folder','colores','borrador','plumón','marcador','resistol','libreta'];
    let populares = products.filter(p =>
      popularKeywords.some(k => p.nombre.toLowerCase().includes(k))
    ).slice(0, 6);
    if (populares.length < 4) {
      const extras = products.filter(p => !populares.includes(p)).slice(0, 6 - populares.length);
      populares = [...populares, ...extras];
    }

    const combosHTML = combos.length
      ? combos.map(buildComboCard).join('')
      : '<div style="color:var(--text-muted);padding:20px;">No hay paquetes disponibles en este momento.</div>';

    const popularesHTML = populares.map((p, i) => {
      const idx = products.indexOf(p);
      return `
        <div class="item" style="position:relative;">
          <div style="position:absolute;top:8px;left:8px;background:var(--accent-secondary);color:var(--on-accent);font-size:11px;font-weight:800;padding:3px 8px;border-radius:10px;">⭐ Popular</div>
          <img class="thumb" src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}" loading="lazy" />
          <h3 style="margin-top:10px;font-size:14px;">${escapeHtml(p.nombre)}</h3>
          <div class="price">$${Number(p.precio).toFixed(2)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Stock: ${p.stock ?? 0}</div>
          <button class="btn" onclick="openModalCantidad(${idx})" ${p.stock <= 0 ? 'disabled' : ''}>
            ${p.stock <= 0 ? 'Sin stock' : 'Agregar'}
          </button>
        </div>`;
    }).join('');

    appContent.innerHTML = `
      <section class="hero" style="background:linear-gradient(135deg, var(--accent-secondary) 0%, var(--accent) 100%);padding:50px 20px;box-shadow:0 4px 15px rgba(41,59,93,0.1);">
        <div class="container-full">
          <h1 style="font-size:42px;color:var(--on-accent);">¡Bienvenido a Papelería El Profe!</h1>
          <p style="font-size:18px;color:var(--on-accent);font-weight:600;margin-top:10px;opacity:0.85;">Útiles escolares y material de oficina al mejor precio.</p>
          <a href="#catalogo" class="btn secondary" style="margin-top:18px;display:inline-block;padding:12px 28px;font-size:16px;text-decoration:none;">Ver Catálogo Completo</a>
        </div>
      </section>

      <section style="padding:30px 20px 10px;">
        <div class="container-full">
          <h2 style="margin-bottom:18px;color:var(--text);">🎒 Paquetes Especiales</h2>
          <div class="carousel-container" id="combosCarouselInicio">${combosHTML}</div>
        </div>
      </section>

      <section style="padding:30px 20px 50px;">
        <div class="container-full">
          <h2 style="margin-bottom:18px;color:var(--text);">⭐ Lo Más Pedido en la Escuela</h2>
          <div class="grid">${popularesHTML}</div>
        </div>
      </section>
    `;

    setupCarousel('combosCarouselInicio');
  }

  /* ── CATÁLOGO ── */
  else if (hash === '#catalogo') {
    appContent.innerHTML = `
      <section id="productos">
        <div class="container-full">
          <h2 style="margin-bottom:20px;color:var(--text);">Catálogo Completo</h2>
          <div class="grid" id="catalogo"></div>
        </div>
      </section>
    `;
    renderCatalog();
  }

  /* ── MOCHILITA ── */
  else if (hash === '#mochilita') {
    appContent.innerHTML = `
      <section id="mochilita">
        <div class="container-full">
          <h3>Mochilita</h3>
          <ul id="listaMochilita"></ul>
          <div id="mensajeCarrito" style="display:none;">Aún no has agregado productos.</div>
          <div id="totalCarrito" style="font-weight:bold;text-align:right;margin-top:10px;">Total: $0.00</div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;">
            <button class="btn" onclick="confirmarPedido()">Confirmar Pedido</button>
          </div>
        </div>
      </section>`;
    renderCart();
  }

  /* ── CONTACTO ── */
  else if (hash === '#contacto') {
    appContent.innerHTML = `
      <section id="contacto">
        <div class="container-full">
          <h2>Contacto y Ubicación</h2>
          <p><strong>Tel:</strong> 722-518-1849</p>
          <p><strong>Dirección:</strong> Av. Rincón del álamo, Villa de Almoloya de Juárez, México</p>
          <p><strong>Horario:</strong> Lun-Vie 7:00-22:00 • Sáb-Dom 10:00-21:30</p>
        </div>
      </section>`;
  }
}

window.addEventListener('hashchange', router);

/* ── INICIALIZACIÓN ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  try {
    [products, combos, orders] = await Promise.all([loadProducts(), loadCombos(), loadOrders()]);
  } catch (e) {
    console.error("Error cargando datos iniciales:", e);
  }

  // Siempre empezar en #inicio sin importar el hash guardado en el navegador
  history.replaceState(null, null, '#inicio');
  router();
  setupSpeechRecognition();
  setupAssistantBox();
  setupFloatingButtons();
  setupViewerDrag();
});