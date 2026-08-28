// Admin Dashboard Controller

// Helper: resolve image URL - handles Cloudinary absolute URLs and legacy local paths
function resolveImageUrl(imagePath) {
  if (!imagePath) return '/images/mango_lassi.jpg';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return '/' + imagePath.replace(/^\//, '');
}

document.addEventListener('DOMContentLoaded', () => {
  initAdmin();
});

// Admin State
let orders = [];
let menuItems = [];
let tables = [];
let activeTab = 'orders';
let isEditMode = false;
let editItemId = null;
let orderPollingInterval = null;

// Initialize
async function initAdmin() {
  setupNavigation();
  setupFormHandlers();
  
  // Initial load
  await refreshData();

  // High-frequency polling for orders (every 4 seconds)
  orderPollingInterval = setInterval(pollOrdersOnly, 4000);
}

// 1. Tab Navigation
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.dashboard-view');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      navItems.forEach(nav => nav.classList.remove('active'));
      views.forEach(view => view.classList.remove('active'));

      item.classList.add('active');
      activeTab = item.dataset.tab;
      
      const activeView = document.getElementById(`${activeTab}-view`);
      if (activeView) activeView.classList.add('active');

      // Refresh corresponding data
      refreshData();
    });
  });
}

// 2. Data Fetch & Refresh
async function refreshData() {
  try {
    if (activeTab === 'orders') {
      orders = await API.getOrders();
      tables = await API.getTables();
      renderStats();
      renderKanbanBoard();
    } else if (activeTab === 'menu') {
      menuItems = await API.getMenu();
      renderMenuEditorTable();
    } else if (activeTab === 'tables') {
      tables = await API.getTables();
      renderTablesGrid();
    }
  } catch (error) {
    showToast('Failed to load dashboard data.', 'error');
  }
}

// Separate lightweight polling loop for orders
async function pollOrdersOnly() {
  try {
    orders = await API.getOrders();
    renderStats();
    if (activeTab === 'orders') {
      renderKanbanBoard();
    }
  } catch (error) {
    console.error('Error polling orders:', error);
  }
}

// 3. Render Dashboard Stats
function renderStats() {
  // Today's Date representation
  const todayStr = new Date().toDateString();
  
  // Filter today's completed/ready orders for sales
  const todaySales = orders
    .filter(o => new Date(o.createdAt).toDateString() === todayStr && o.status === 'Completed')
    .reduce((sum, o) => sum + o.total, 0);

  // Active orders (not Completed)
  const activeOrdersCount = orders.filter(o => o.status !== 'Completed').length;
  
  // Pending orders
  const pendingCount = orders.filter(o => o.status === 'Pending').length;

  document.getElementById('stat-sales-val').textContent = `₹${todaySales}`;
  document.getElementById('stat-active-val').textContent = activeOrdersCount;
  document.getElementById('stat-pending-val').textContent = pendingCount;
  
  if (document.getElementById('stat-tables-val')) {
    document.getElementById('stat-tables-val').textContent = tables.length;
  }
}

// 4. Render Kanban Board
function renderKanbanBoard() {
  const pendingCol = document.getElementById('cards-pending');
  const preparingCol = document.getElementById('cards-preparing');
  const readyCol = document.getElementById('cards-ready');
  const completedCol = document.getElementById('cards-completed');

  // Clear previous cards
  pendingCol.innerHTML = '';
  preparingCol.innerHTML = '';
  readyCol.innerHTML = '';
  completedCol.innerHTML = '';

  const counts = { Pending: 0, Preparing: 0, Ready: 0, Completed: 0 };

  orders.forEach(order => {
    counts[order.status]++;

    const card = document.createElement('div');
    card.className = 'order-card';
    
    // Items text
    const itemsHtml = order.items.map(item => `
      <div class="order-card-item">
        <span>${item.name} <strong class="order-card-qty">x${item.qty}</strong></span>
        <span>₹${item.price * item.qty}</span>
      </div>
    `).join('');

    // Dynamic action button based on stage
    let actionBtnHtml = '';
    if (order.status === 'Pending') {
      actionBtnHtml = `<button class="btn btn-primary btn-sm order-card-action" onclick="updateStatus('${order.id}', 'Preparing')">Start Preparing</button>`;
    } else if (order.status === 'Preparing') {
      actionBtnHtml = `<button class="btn btn-accent btn-sm order-card-action" onclick="updateStatus('${order.id}', 'Ready')">Mark as Ready</button>`;
    } else if (order.status === 'Ready') {
      actionBtnHtml = `<button class="btn btn-primary btn-sm order-card-action" style="background:var(--color-green)" onclick="updateStatus('${order.id}', 'Completed')">Mark as Served</button>`;
    }

    card.innerHTML = `
      <div class="order-card-header">
        <div class="order-card-meta">
          <span class="order-card-num">Order #${order.orderNumber}</span>
          <span class="order-card-time">${formatTime(order.createdAt)}</span>
        </div>
        <span class="order-card-table">${order.tableNumber === 'Takeaway' ? 'Takeaway' : 'Table ' + order.tableNumber}</span>
      </div>
      <div class="order-card-customer">
        <div class="customer-name-phone">
          <span>${order.customerName}</span>
          <span class="customer-phone">${order.customerPhone}</span>
        </div>
      </div>
      <div class="order-card-items">
        ${itemsHtml}
      </div>
      <div class="order-card-footer">
        <span>Total</span>
        <span class="order-card-total">₹${order.total}</span>
      </div>
      ${actionBtnHtml}
    `;

    // Append to corresponding column
    if (order.status === 'Pending') pendingCol.appendChild(card);
    else if (order.status === 'Preparing') preparingCol.appendChild(card);
    else if (order.status === 'Ready') readyCol.appendChild(card);
    else if (order.status === 'Completed') completedCol.appendChild(card);
  });

  // Update counts on UI headers
  document.getElementById('count-pending').textContent = counts.Pending;
  document.getElementById('count-preparing').textContent = counts.Preparing;
  document.getElementById('count-ready').textContent = counts.Ready;
  document.getElementById('count-completed').textContent = counts.Completed;
}

// Handle Order Status progression
async function updateStatus(orderId, nextStatus) {
  try {
    await API.updateOrderStatus(orderId, nextStatus);
    showToast(`Order updated to ${nextStatus}`, 'success');
    await refreshData();
  } catch (error) {
    showToast('Failed to update order status.', 'error');
  }
}
// Expose function globally for HTML onclick hooks
window.updateStatus = updateStatus;

// 5. Render Menu Editor
function renderMenuEditorTable() {
  const tbody = document.getElementById('menu-items-tbody');
  tbody.innerHTML = '';

  if (menuItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No menu items found. Add some!</td></tr>';
    return;
  }

  menuItems.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img class="table-img-thumb" src="${resolveImageUrl(item.image)}" alt="${item.name}" onerror="this.src='/images/mango_lassi.jpg'"></td>
      <td style="font-weight: 700;">${item.name}</td>
      <td><span class="badge badge-pending">${item.category}</span></td>
      <td style="font-weight: 800; font-family: var(--font-family-title)">₹${item.price}</td>
      <td>
        <div class="action-buttons-cell">
          <button class="btn-icon-only btn-edit" onclick="editMenuItem('${item.id}')"><i data-lucide="edit-2" style="width:16px;height:16px"></i></button>
          <button class="btn-icon-only btn-delete" onclick="deleteMenuItem('${item.id}')"><i data-lucide="trash-2" style="width:16px;height:16px"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  lucide.createIcons();
}

// 6. Menu Forms and Preview Handlers
function setupFormHandlers() {
  const menuForm = document.getElementById('menu-form');
  const imageInput = document.getElementById('item-image-input');
  const imagePreview = document.getElementById('image-preview');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  const tableForm = document.getElementById('table-form');

  // File Upload Preview
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        previewPlaceholder.style.display = 'none';
      };
      reader.readAsDataURL(file);
    } else {
      imagePreview.style.display = 'none';
      previewPlaceholder.style.display = 'flex';
    }
  });

  // Cancel Menu Edit Mode
  cancelEditBtn.addEventListener('click', resetMenuForm);

  // Menu Form Submit (Insert / Update)
  menuForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('item-name').value.trim();
    const price = document.getElementById('item-price').value.trim();
    const category = document.getElementById('item-category').value;
    const description = document.getElementById('item-desc').value.trim();

    if (!name || !price || !category) {
      showToast('Name, price and category are required', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('category', category);
    formData.append('description', description);
    
    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    try {
      if (isEditMode) {
        await API.updateMenuItem(editItemId, formData);
        showToast('Menu item updated successfully!', 'success');
      } else {
        await API.createMenuItem(formData);
        showToast('New menu item created!', 'success');
      }
      resetMenuForm();
      await refreshData();
    } catch (error) {
      showToast(error.message || 'Error processing menu action', 'error');
    }
  });

  // Table Add Form Submit
  tableForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = document.getElementById('table-num').value.trim();
    const name = document.getElementById('table-name').value.trim();

    if (!number || !name) {
      showToast('Table number and name are required', 'error');
      return;
    }

    try {
      await API.createTable(number, name);
      showToast(`Table ${number} registered!`, 'success');
      tableForm.reset();
      await refreshData();
    } catch (error) {
      showToast(error.message || 'Failed to add table', 'error');
    }
  });
}

// Edit menu details triggers
async function editMenuItem(itemId) {
  const item = menuItems.find(m => m.id === itemId);
  if (!item) return;

  isEditMode = true;
  editItemId = itemId;

  // Fill forms
  document.getElementById('item-name').value = item.name;
  document.getElementById('item-price').value = item.price;
  document.getElementById('item-category').value = item.category;
  document.getElementById('item-desc').value = item.description;

  // Preview existing image
  const imagePreview = document.getElementById('image-preview');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  imagePreview.src = resolveImageUrl(item.image);
  imagePreview.style.display = 'block';
  previewPlaceholder.style.display = 'none';

  // Toggle buttons
  document.getElementById('submit-menu-btn').innerHTML = '<i data-lucide="save"></i> Update Item';
  document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
  document.getElementById('form-title').textContent = 'Edit Menu Item';
  
  lucide.createIcons();
}
window.editMenuItem = editMenuItem;

function resetMenuForm() {
  isEditMode = false;
  editItemId = null;
  document.getElementById('menu-form').reset();
  
  const imagePreview = document.getElementById('image-preview');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  imagePreview.src = '';
  imagePreview.style.display = 'none';
  previewPlaceholder.style.display = 'flex';

  document.getElementById('submit-menu-btn').innerHTML = '<i data-lucide="plus-circle"></i> Add Menu Item';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  document.getElementById('form-title').textContent = 'Add Menu Item';
  
  lucide.createIcons();
}

// Delete menu details trigger
async function deleteMenuItem(itemId) {
  if (!confirm('Are you sure you want to delete this menu item?')) return;

  try {
    await API.deleteMenuItem(itemId);
    showToast('Menu item deleted.', 'success');
    await refreshData();
  } catch (error) {
    showToast('Failed to delete menu item.', 'error');
  }
}
window.deleteMenuItem = deleteMenuItem;

// 7. Render Tables Grid
function renderTablesGrid() {
  const grid = document.getElementById('tables-grid');
  grid.innerHTML = '';

  if (tables.length === 0) {
    grid.innerHTML = '<div class="cart-empty-state" style="grid-column:1/-1">No tables registered yet.</div>';
    return;
  }

  tables.forEach(table => {
    const card = document.createElement('div');
    card.className = 'table-card';
    card.innerHTML = `
      <button class="table-card-delete-btn" onclick="deleteTable('${table.id}')">
        <i data-lucide="trash-2" style="width:14px;height:14px"></i>
      </button>
      <div class="table-card-num">${table.number}</div>
      <div class="table-card-name">${table.name}</div>
      <div class="table-card-actions">
        <button class="btn btn-secondary btn-sm" style="width:100%" onclick="showQrModal('${table.number}')">
          <i data-lucide="qr-code" style="width:14px;height:14px"></i> QR Code
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  lucide.createIcons();
}

// Delete table action
async function deleteTable(tableId) {
  if (!confirm('Are you sure you want to delete this table? Orders at this table will lose connection.')) return;

  try {
    await API.deleteTable(tableId);
    showToast('Table deleted.', 'success');
    await refreshData();
  } catch (error) {
    showToast('Failed to delete table.', 'error');
  }
}
window.deleteTable = deleteTable;

// 8. Generate & Display QR Code Modal
function showQrModal(tableNum) {
  const modal = document.getElementById('qr-modal');
  const qrContainer = document.getElementById('qr-print-code');
  const title = document.getElementById('qr-table-title');
  const overlay = document.getElementById('drawer-overlay');

  title.textContent = `Table ${tableNum}`;
  qrContainer.innerHTML = '';

  // Construct URL using current host so QR always points to the correct server IP/port
  // Works for both localhost (admin) and LAN IP (customers scanning from phones)
  const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? window.location.host   // Use as-is when on the same machine
    : window.location.host;  // Use as-is when already on LAN IP
  const url = `${window.location.protocol}//${host}/?table=${encodeURIComponent(tableNum)}`;

  // Generate QR Code inside container (Uses qrcode.js library via CDN loaded in admin.html)
  new QRCode(qrContainer, {
    text: url,
    width: 180,
    height: 180,
    colorDark: "#1e120a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  modal.classList.add('active');
  overlay.classList.add('active');

  // Print button listener
  document.getElementById('print-qr-btn').onclick = () => {
    window.print();
  };

  // Close QR modal action
  const closeModal = () => {
    modal.classList.remove('active');
    overlay.classList.remove('active');
  };
  
  document.getElementById('close-qr-modal').onclick = closeModal;
  document.getElementById('close-qr-modal-footer').onclick = closeModal;
  overlay.onclick = closeModal;
}
window.showQrModal = showQrModal;

// 9. Time Formatter Helper
function formatTime(isoString) {
  const date = new Date(isoString);
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutes} ${ampm}`;
}

// 10. Toasts
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'check-circle' : 'alert-circle';
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}
