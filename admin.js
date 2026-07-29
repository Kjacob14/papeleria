const API = 'api.php';
let products = [];
let orders = [];
let editingProductIndex = null;

/* ── HELPER i18n ── */
function getDbText(texto) {
  try {
    if (typeof texto === 'string' && texto.startsWith('{')) {
      const obj = JSON.parse(texto);
      return obj[typeof currentLang !== 'undefined' ? currentLang : 'es'] || obj['es'] || '';
    }
  } catch (e) {}
  return texto;
}

function escapeHtmlAdmin(s) {
  return String(s || '').replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

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
    msg.classList.add('is-visible');
    return;
  }

  try {
    const data = await apiPost('login', { correo, contrasena: p });

    if (data.ok && data.rol === 'admin') {
      document.getElementById('loginSection').classList.add('u-hidden');
      document.getElementById('dashboardSection').classList.remove('u-hidden');
      document.getElementById('btnLogout').classList.remove('u-hidden');
      loadDashboardData();
    } else if (data.ok && data.rol !== 'admin') {
      msg.textContent   = 'Esta cuenta no tiene permisos de administrador';
      msg.classList.add('is-visible');
    } else {
      msg.textContent   = data.error || 'Correo o contraseña incorrectos';
      msg.classList.add('is-visible');
    }
  } catch (e) {
    msg.textContent   = 'Error de conexión con el servidor';
    msg.classList.add('is-visible');
  }
}

async function logoutAdmin() {
  await apiPost('logout', {}).catch(() => {});
  window.location.href = 'index.php';
}

async function verificarSesionActiva() {
  const login     = document.getElementById('loginSection');
  const dashboard = document.getElementById('dashboardSection');
  const checking  = document.getElementById('checkingSession');
  const btnLogout = document.getElementById('btnLogout');

  try {
    const data = await apiGet('verificar_sesion');
    if (data.ok && data.sesionActiva) {
      login.classList.add('u-hidden');
      dashboard.classList.remove('u-hidden');
      btnLogout.classList.remove('u-hidden');
      loadDashboardData();
    } else {
      dashboard.classList.add('u-hidden');
      btnLogout.classList.add('u-hidden');
      login.classList.remove('u-hidden');
    }
  } catch (e) {
    dashboard.classList.add('u-hidden');
    btnLogout.classList.add('u-hidden');
    login.classList.remove('u-hidden');
  } finally {
    checking.classList.add('u-hidden');
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

/* ── MODAL ACCESIBLE ────────────────────────────── */
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
  
  // Aquí usamos getDbText para que al editar un producto veas el JSON completo si existe
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
  if (!confirm(`¿Eliminar "${getDbText(p.nombre)}"?`)) return;
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
    // Usamos getDbText para traducir el nombre del producto en la tabla
    const nombre = getDbText(p.nombre);
    
    // Traducimos los botones "Editar" y "Eliminar" de la tabla
    const btnEdit = typeof t === 'function' ? t('admin.btn_edit') : 'Editar';
    const btnDelete = typeof t === 'function' ? t('admin.btn_delete') : 'Eliminar';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtmlAdmin(nombre)}</td>
      <td>$${Number(p.precio).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>
        <button class="btn btn-compact" onclick="openEditProductModal(${i})" aria-label="Editar ${escapeHtmlAdmin(nombre)}">${btnEdit}</button>
        <button class="btn btn-cancel btn-compact danger" onclick="deleteProduct(${i})" aria-label="Eliminar ${escapeHtmlAdmin(nombre)}">${btnDelete}</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderOrdersList() {
  const div = document.getElementById('ordersList');
  if (orders.length === 0) {
    div.innerHTML = '<div class="u-text-muted">No hay pedidos registrados.</div>'; return;
  }
  div.innerHTML = '';
  orders.forEach(o => {
    const el = document.createElement('div');
    el.className = 'order-entry';
    el.innerHTML = `
      <div class="order-id">${escapeHtmlAdmin(o.id)} <span class="order-date">(${escapeHtmlAdmin(o.fecha)})</span></div>
      <div class="order-items">${escapeHtmlAdmin(o.items)}</div>
      <div class="order-total">Total: $${Number(o.total).toFixed(2)} &bull; ${escapeHtmlAdmin(o.correo) || 'Venta en mostrador'}</div>`;
    div.appendChild(el);
  });
}

/* ── INICIALIZACIÓN ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', verificarSesionActiva);

/* ── EVENTO DE CAMBIO DE IDIOMA ── */
document.addEventListener('languageChanged', () => {
  renderAdminProductsTable();
});