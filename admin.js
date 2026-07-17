const API = 'api.php';
let products = [];
let orders = [];
let editingProductIndex = null;

/**
 * Fase 6: escapa texto antes de insertarlo vía innerHTML (nombres de
 * producto, correos de pedidos). admin.js no comparte módulo con
 * app.js, así que se define aquí una copia equivalente de la función
 * que app.js ya usa para el mismo propósito.
 */
function escapeHtmlAdmin(s) {
  return String(s || '').replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

/**
 * Fase 3: el backend responde con códigos HTTP reales (400, 401, 404,
 * 409, etc.), no solo 200/500. Antes, cualquier código distinto de
 * 2xx hacía throw sin leer el cuerpo, así que mensajes de error como
 * "Producto no encontrado" nunca llegaban a mostrarse en el panel.
 * Ahora siempre se intenta leer el JSON (que siempre trae
 * { ok, error? }), sin importar el código HTTP. Solo se lanza una
 * excepción real si la respuesta no es JSON válido (fallo de
 * conexión genuino).
 */
async function apiGet(action) {
  const res = await fetch(`${API}?action=${action}`);
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`HTTP ${res.status}`);
  }
}

async function apiPost(action, data) {
  const res = await fetch(`${API}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`HTTP ${res.status}`);
  }
}

/* ── AUTENTICACIÓN ───────────────────────────────────────── */
async function doAdminLogin() {
  const correo = document.getElementById('loginUser').value.trim();
  const p      = document.getElementById('loginPass').value.trim();
  const msg    = document.getElementById('loginMsg');

  if (!correo || !p) {
    msg.textContent = 'Completa todos los campos';
    msg.style.display = 'block';
    return;
  }

  try {
    const data = await apiPost('login', { correo, contrasena: p });

    if (data.ok && data.rol === 'admin') {
      document.getElementById('loginSection').style.display    = 'none';
      document.getElementById('dashboardSection').style.display = 'block';
      document.getElementById('btnLogout').style.display        = 'inline-block';
      loadDashboardData();
    } else if (data.ok && data.rol !== 'admin') {
      msg.textContent   = 'Esta cuenta no tiene permisos de administrador';
      msg.style.display = 'block';
    } else {
      msg.textContent   = data.error || 'Correo o contraseña incorrectos';
      msg.style.display = 'block';
    }
  } catch (e) {
    msg.textContent   = 'Error de conexión con el servidor';
    msg.style.display = 'block';
  }
}

async function logoutAdmin() {
  await apiPost('logout', {}).catch(() => {});
  window.location.href = 'index.php';
}

/**
 * Fase 5: evita el doble inicio de sesión. Antes, un admin que ya
 * había iniciado sesión desde la tienda pública (index.php) era
 * redirigido a admin.html, pero esta página siempre mostraba el
 * formulario de login sin verificar si ya existía una sesión activa
 * en el servidor — obligando a escribir las credenciales dos veces.
 *
 * Ahora, al cargar admin.html, se pregunta primero al backend
 * (verificar_sesion) si ya hay sesión de admin activa. Si la hay, se
 * salta directo al dashboard; si no, se muestra el login normal.
 */
async function verificarSesionActiva() {
  const login     = document.getElementById('loginSection');
  const dashboard = document.getElementById('dashboardSection');
  const checking  = document.getElementById('checkingSession');
  const btnLogout = document.getElementById('btnLogout');

  try {
    const data = await apiGet('verificar_sesion');
    if (data.ok && data.sesionActiva) {
      login.style.display     = 'none';
      dashboard.style.display = 'block';
      btnLogout.style.display = 'inline-block';
      loadDashboardData();
    } else {
      dashboard.style.display = 'none';
      btnLogout.style.display = 'none';
      login.style.display     = 'block';
    }
  } catch (e) {
    // Fallo de conexión genuino: se cae al login normal, sin bloquear
    // el acceso a la página.
    dashboard.style.display = 'none';
    btnLogout.style.display = 'none';
    login.style.display     = 'block';
  } finally {
    checking.style.display = 'none';
  }
}

/* ── CARGA DE DATOS ──────────────────────────────────────── */
async function loadDashboardData() {
  try {
    products = await apiGet('productos');
    orders = await apiGet('pedidos');
    renderAdminProductsTable();
    renderOrdersList();
  } catch (e) {
    console.error("Error cargando datos:", e);
  }
}

/* ── MODAL ACCESIBLE (equivalente al de app.js) ──────────────
 * Fase 6: admin.js no comparte módulo con app.js, así que se replica
 * aquí la misma lógica de foco/trampa de Tab/Escape para que
 * modalProductEdit se comporte igual que los modales del sitio
 * público.
 */
let elementoAntesDelModalAdmin = null;
let modalActivoIdAdmin = null;

function getFocusablesEnModalAdmin(modalEl) {
  return Array.from(modalEl.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null);
}

function manejarTeclaModalAdmin(e) {
  if (!modalActivoIdAdmin) return;
  const modal = document.getElementById(modalActivoIdAdmin);
  if (!modal) return;

  if (e.key === 'Escape') { e.preventDefault(); hideModalAdmin(modalActivoIdAdmin); return; }

  if (e.key === 'Tab') {
    const focusables = getFocusablesEnModalAdmin(modal);
    if (focusables.length === 0) return;
    const primero = focusables[0];
    const ultimo  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }
}

function showModalAdmin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  elementoAntesDelModalAdmin = document.activeElement;
  modalActivoIdAdmin = id;
  el.style.display = 'block';
  el.setAttribute('aria-hidden', 'false');
  const focusables = getFocusablesEnModalAdmin(el);
  if (focusables.length > 0) focusables[0].focus();
  document.addEventListener('keydown', manejarTeclaModalAdmin);
}

function hideModalAdmin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');
  if (modalActivoIdAdmin === id) {
    document.removeEventListener('keydown', manejarTeclaModalAdmin);
    modalActivoIdAdmin = null;
    if (elementoAntesDelModalAdmin && typeof elementoAntesDelModalAdmin.focus === 'function') {
      elementoAntesDelModalAdmin.focus();
    }
    elementoAntesDelModalAdmin = null;
  }
}

/* ── CRUD DE PRODUCTOS ───────────────────────────────────── */
function openNewProductModal() {
  editingProductIndex = null;
  document.getElementById('prodModalTitle').textContent = 'Registrar nuevo producto';
  document.getElementById('prodName').value = '';
  document.getElementById('prodPrice').value = '';
  document.getElementById('prodStock').value = '';
  document.getElementById('prodImage').value = '';
  showModalAdmin('modalProductEdit');
}

function openEditProductModal(index) {
  editingProductIndex = index;
  const p = products[index];
  document.getElementById('prodModalTitle').textContent = 'Editar producto';
  document.getElementById('prodName').value = p.nombre;
  document.getElementById('prodPrice').value = p.precio;
  document.getElementById('prodStock').value = p.stock;
  document.getElementById('prodImage').value = p.imagen;
  showModalAdmin('modalProductEdit');
}

function closeProductModal() {
  hideModalAdmin('modalProductEdit');
}

async function saveProductFromModal() {
  const name = document.getElementById('prodName').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value);
  const img = document.getElementById('prodImage').value.trim();
  const msg = document.getElementById('prodModalMsg');

  if (!name || isNaN(price) || isNaN(stock)) {
    msg.textContent = 'Nombre, precio y stock son obligatorios'; return;
  }

  try {
    if (editingProductIndex !== null) {
      const p = products[editingProductIndex];
      const payload = { id: p.id, nombre: name, precio: price, stock: stock, imagen: img, variantes: p.variantes };
      const res = await apiPost('editar_producto', payload);
      // Fase 3: el backend ahora valida (producto existente, precio
      // válido, etc.) y puede rechazar la edición. Antes se asumía
      // éxito siempre; ahora se revisa res.ok antes de actualizar
      // el estado local, para no desincronizar la tabla del admin.
      if (!res.ok) {
        msg.textContent = res.error || 'Error al guardar los cambios';
        return;
      }
      products[editingProductIndex] = payload;
    } else {
      const payload = { nombre: name, precio: price, stock: stock, imagen: img };
      const res = await apiPost('agregar_producto', payload);
      if (!res.ok) {
        msg.textContent = res.error || 'Error al registrar el producto';
        return;
      }
      products.unshift({ id: res.id, ...payload });
    }
    renderAdminProductsTable();
    closeProductModal();
  } catch (e) {
    msg.textContent = 'Error de conexión al guardar';
  }
}

async function deleteProduct(index) {
  const p = products[index];
  if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
  try {
    const res = await apiPost('eliminar_producto', { id: p.id });
    if (!res.ok) {
      alert(res.error || 'No se pudo eliminar el producto');
      return;
    }
    products.splice(index, 1);
    renderAdminProductsTable();
  } catch (e) {
    alert('Error de conexión al eliminar producto');
  }
}

/* ── RENDERIZADO ─────────────────────────────────────────── */
function renderAdminProductsTable() {
  const tbody = document.querySelector('#adminProductsTable tbody');
  tbody.innerHTML = '';
  products.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #eee';
    tr.innerHTML = `
      <td style="padding:12px;">${escapeHtmlAdmin(p.nombre)}</td>
      <td style="padding:12px;">$${Number(p.precio).toFixed(2)}</td>
      <td style="padding:12px;">${p.stock}</td>
      <td style="padding:12px;">
        <button class="btn" style="padding:6px 10px; font-size:12px;" onclick="openEditProductModal(${i})" aria-label="Editar ${escapeHtmlAdmin(p.nombre)}">Editar</button>
        <button class="btn btn-cancel" style="padding:6px 10px; font-size:12px; background:#c9302c; color:white;" onclick="deleteProduct(${i})" aria-label="Eliminar ${escapeHtmlAdmin(p.nombre)}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderOrdersList() {
  const div = document.getElementById('ordersList');
  if (orders.length === 0) {
    div.innerHTML = '<div style="color:#888;">No hay pedidos registrados.</div>'; return;
  }
  div.innerHTML = '';
  orders.forEach(o => {
    const el = document.createElement('div');
    el.style.cssText = 'border-bottom:1px solid #f1f3f6; padding:12px 0;';
    el.innerHTML = `
      <div style="font-weight:700; color:var(--accent-dark);">${escapeHtmlAdmin(o.id)} <span style="font-weight:400; color:#666; font-size:13px;">(${escapeHtmlAdmin(o.fecha)})</span></div>
      <div style="font-size:14px; margin-top:6px; color:#444;">${escapeHtmlAdmin(o.items)}</div>
      <div style="margin-top:6px; font-weight:700; color:#222;">Total: $${Number(o.total).toFixed(2)} &bull; ${escapeHtmlAdmin(o.correo) || 'Venta en mostrador'}</div>`;
    div.appendChild(el);
  });
}

/* ── INICIALIZACIÓN ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', verificarSesionActiva);