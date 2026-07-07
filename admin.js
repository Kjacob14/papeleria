const API = 'api.php';
let products = [];
let orders = [];
let editingProductIndex = null;

async function apiGet(action) {
  const res = await fetch(`${API}?action=${action}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(action, data) {
  const res = await fetch(`${API}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  document.getElementById('loginSection').style.display     = 'block';
  document.getElementById('dashboardSection').style.display = 'none';
  document.getElementById('btnLogout').style.display        = 'none';
  document.getElementById('loginPass').value                = '';
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

/* ── CRUD DE PRODUCTOS ───────────────────────────────────── */
function openNewProductModal() {
  editingProductIndex = null;
  document.getElementById('prodModalTitle').textContent = 'Registrar nuevo producto';
  document.getElementById('prodName').value = '';
  document.getElementById('prodPrice').value = '';
  document.getElementById('prodStock').value = '';
  document.getElementById('prodImage').value = '';
  document.getElementById('modalProductEdit').style.display = 'block';
}

function openEditProductModal(index) {
  editingProductIndex = index;
  const p = products[index];
  document.getElementById('prodModalTitle').textContent = 'Editar producto';
  document.getElementById('prodName').value = p.nombre;
  document.getElementById('prodPrice').value = p.precio;
  document.getElementById('prodStock').value = p.stock;
  document.getElementById('prodImage').value = p.imagen;
  document.getElementById('modalProductEdit').style.display = 'block';
}

function closeProductModal() {
  document.getElementById('modalProductEdit').style.display = 'none';
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
      await apiPost('editar_producto', payload);
      products[editingProductIndex] = payload;
    } else {
      const payload = { nombre: name, precio: price, stock: stock, imagen: img };
      const res = await apiPost('agregar_producto', payload);
      if (res.ok) products.unshift({ id: res.id, ...payload });
    }
    renderAdminProductsTable();
    closeProductModal();
  } catch (e) {
    msg.textContent = 'Error al guardar';
  }
}

async function deleteProduct(index) {
  const p = products[index];
  if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
  try {
    await apiPost('eliminar_producto', { id: p.id });
    products.splice(index, 1);
    renderAdminProductsTable();
  } catch (e) {
    alert('Error al eliminar producto');
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
      <td style="padding:12px;">${p.nombre}</td>
      <td style="padding:12px;">$${Number(p.precio).toFixed(2)}</td>
      <td style="padding:12px;">${p.stock}</td>
      <td style="padding:12px;">
        <button class="btn" style="padding:6px 10px; font-size:12px;" onclick="openEditProductModal(${i})">Editar</button>
        <button class="btn btn-cancel" style="padding:6px 10px; font-size:12px; background:#d9534f; color:white;" onclick="deleteProduct(${i})">Eliminar</button>
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
      <div style="font-weight:700; color:var(--accent-dark);">${o.id} <span style="font-weight:400; color:#666; font-size:13px;">(${o.fecha})</span></div>
      <div style="font-size:14px; margin-top:6px; color:#444;">${o.items}</div>
      <div style="margin-top:6px; font-weight:700; color:#222;">Total: $${Number(o.total).toFixed(2)} &bull; ${o.correo || 'Venta en mostrador'}</div>`;
    div.appendChild(el);
  });
}