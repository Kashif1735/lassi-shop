// Helper: resolve image URL - Cloudinary URLs are absolute, legacy local paths are relative
function resolveImageUrl(imagePath) {
  if (!imagePath) return '/images/mango_lassi.jpg'; // fallback
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return '/' + imagePath.replace(/^\//, ''); // ensure leading slash for local paths
}

// Customer Side Logic
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// App State
let menuItems = [];
let cart = JSON.parse(localStorage.getItem('lassi_cart')) || [];
let activeCategory = 'All';
let tableNumber = null;
let activeOrderId = localStorage.getItem('lassi_active_order_id') || null;
let statusInterval = null;

// Initialize App
async function initApp() {
  detectTableNumber();
  setupEventListeners();
  updateCartBadge();
  updateCartBar();
  
  // If there's an active order, start tracking it
  if (activeOrderId) {
    showOrderTracker();
    startTrackingOrder();
  }

  // Load Menu from server
  await loadMenu();
}

// 1. Detect Table Number
function detectTableNumber() {
  const urlParams = new URLSearchParams(window.location.search);
  const table = urlParams.get('table');
  
  if (table) {
    tableNumber = table;
    sessionStorage.setItem('lassi_table_number', table);
  } else {
    tableNumber = sessionStorage.getItem('lassi_table_number');
  }

  const indicator = document.getElementById('table-number-val');
  if (tableNumber) {
    indicator.textContent = `Table ${tableNumber}`;
  } else {
    indicator.textContent = 'Takeaway';
  }
}

// 2. Fetch Menu Items
async function loadMenu() {
  const menuContainer = document.getElementById('menu-grid');
  menuContainer.innerHTML = '<div class="cart-empty-state">Loading delicious items...</div>';
  
  try {
    menuItems = await API.getMenu();
    renderCategories();
    renderMenu();
  } catch (error) {
    showToast('Failed to load menu. Please refresh.', 'error');
    menuContainer.innerHTML = '<div class="cart-empty-state">Failed to load menu.</div>';
  }
}

// 3. Render Categories Filter
function renderCategories() {
  const container = document.getElementById('categories-list');
  const categories = ['All', ...new Set(menuItems.map(item => item.category))];
  
  container.innerHTML = categories.map(cat => {
    const isActive = cat === activeCategory ? 'active' : '';
    let icon = 'chef-hat';
    if (cat === 'Lassi') icon = 'glass-water';
    if (cat === 'Snacks') icon = 'cookie';
    if (cat === 'Drinks') icon = 'cup-soda';
    if (cat === 'All') icon = 'layout-grid';

    return `
      <button class="category-tab ${isActive}" data-category="${cat}">
        <i data-lucide="${icon}"></i>
        <span>${cat}</span>
      </button>
    `;
  }).join('');
  
  lucide.createIcons();

  // Attach event listeners to tabs
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.category;
      renderMenu();
    });
  });
}

// 4. Render Menu Grid
function renderMenu() {
  const grid = document.getElementById('menu-grid');
  grid.innerHTML = '';

  const filteredItems = activeCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === activeCategory);

  if (filteredItems.length === 0) {
    grid.innerHTML = '<div class="cart-empty-state">No items found in this category.</div>';
    return;
  }

  filteredItems.forEach(item => {
    const cartItem = cart.find(ci => ci.id === item.id);
    const qty = cartItem ? cartItem.qty : 0;

    const card = document.createElement('div');
    card.className = 'menu-card';
    card.innerHTML = `
      <div class="item-image-wrapper">
        <img class="item-image" src="${resolveImageUrl(item.image)}" alt="${item.name}" loading="lazy" onerror="this.src='/images/mango_lassi.jpg'">
      </div>
      <div class="item-info">
        <div class="item-header">
          <span class="item-category">${item.category}</span>
          <h3 class="item-name">${item.name}</h3>
          <p class="item-description">${item.description}</p>
        </div>
        <div class="item-footer">
          <span class="item-price">₹${item.price}</span>
          <div class="cart-control-wrapper" id="cart-control-${item.id}">
            ${qty > 0 ? getQtySelectorHtml(item.id, qty) : getAddBtnHtml(item.id)}
          </div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  
  lucide.createIcons();
  attachCartControlListeners(grid);
}

// Helpers for Add/Qty Buttons
function getAddBtnHtml(itemId) {
  return `<button class="cart-action-btn" data-id="${itemId}">
    <i data-lucide="plus" style="width:16px;height:16px"></i> Add
  </button>`;
}

function getQtySelectorHtml(itemId, qty) {
  return `
    <div class="qty-selector">
      <button class="qty-btn dec-btn" data-id="${itemId}"><i data-lucide="minus" style="width:14px;height:14px"></i></button>
      <span class="qty-val">${qty}</span>
      <button class="qty-btn inc-btn" data-id="${itemId}"><i data-lucide="plus" style="width:14px;height:14px"></i></button>
    </div>
  `;
}

function attachCartControlListeners(parent) {
  parent.querySelectorAll('.cart-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      addToCart(id);
    });
  });

  parent.querySelectorAll('.dec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      updateQty(id, -1);
    });
  });

  parent.querySelectorAll('.inc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      updateQty(id, 1);
    });
  });
}

// 5. Cart Actions
function addToCart(itemId) {
  const item = menuItems.find(m => m.id === itemId);
  if (!item) return;

  cart.push({
    id: item.id,
    name: item.name,
    price: item.price,
    qty: 1
  });

  saveCart();
  refreshCartUI(itemId);
  showToast(`${item.name} added to cart!`);
}

function updateQty(itemId, change) {
  const cartItemIndex = cart.findIndex(ci => ci.id === itemId);
  if (cartItemIndex === -1) return;

  cart[cartItemIndex].qty += change;

  if (cart[cartItemIndex].qty <= 0) {
    const name = cart[cartItemIndex].name;
    cart.splice(cartItemIndex, 1);
    showToast(`${name} removed from cart.`);
  }

  saveCart();
  refreshCartUI(itemId);
}

function saveCart() {
  localStorage.setItem('lassi_cart', JSON.stringify(cart));
  updateCartBadge();
  updateCartBar();
}

function refreshCartUI(itemId) {
  const control = document.getElementById(`cart-control-${itemId}`);
  const cartItem = cart.find(ci => ci.id === itemId);
  
  if (control) {
    if (cartItem) {
      control.innerHTML = getQtySelectorHtml(itemId, cartItem.qty);
    } else {
      control.innerHTML = getAddBtnHtml(itemId);
    }
    lucide.createIcons();
    attachCartControlListeners(control);
  }

  // Also update cart drawer list if active
  if (document.getElementById('cart-drawer').classList.contains('active')) {
    renderCartDrawer();
  }
}

// 6. Update Bottom Float Bar & Badge
function updateCartBadge() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function updateCartBar() {
  const cartBar = document.getElementById('cart-bar-floating');
  if (cart.length === 0) {
    cartBar.style.display = 'none';
    return;
  }

  cartBar.style.display = 'flex';
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  document.getElementById('cart-bar-count-val').textContent = `${count} Item${count > 1 ? 's' : ''}`;
  document.getElementById('cart-bar-total-val').textContent = `₹${total}`;
}

// 7. Render Drawer List
function renderCartDrawer() {
  const list = document.getElementById('cart-items-list');
  const emptyState = document.getElementById('cart-empty-state');
  const footer = document.getElementById('cart-drawer-footer');

  if (cart.length === 0) {
    list.style.display = 'none';
    footer.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  list.style.display = 'flex';
  footer.style.display = 'block';
  emptyState.style.display = 'none';

  list.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-price">₹${item.price} each</span>
      </div>
      <div class="qty-selector">
        <button class="qty-btn drawer-dec-btn" data-id="${item.id}"><i data-lucide="minus" style="width:12px;height:12px"></i></button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn drawer-inc-btn" data-id="${item.id}"><i data-lucide="plus" style="width:12px;height:12px"></i></button>
      </div>
    </div>
  `).join('');

  lucide.createIcons();

  // Attach drawer dec/inc listeners
  list.querySelectorAll('.drawer-dec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      updateQty(id, -1);
      renderCartDrawer();
      renderMenu(); // Sync home menu grid
    });
  });

  list.querySelectorAll('.drawer-inc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      updateQty(id, 1);
      renderCartDrawer();
      renderMenu(); // Sync home menu grid
    });
  });

  // Totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  document.getElementById('drawer-subtotal').textContent = `₹${subtotal}`;
  document.getElementById('drawer-total').textContent = `₹${subtotal}`;
}

// 8. Event Listeners Setup
function setupEventListeners() {
  const cartBar = document.getElementById('cart-bar-floating');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const cartDrawer = document.getElementById('cart-drawer');
  const closeDrawer = document.getElementById('close-drawer');
  const checkoutBtn = document.getElementById('checkout-btn');
  const checkoutModal = document.getElementById('checkout-modal');
  const closeCheckout = document.getElementById('close-checkout');
  const cancelCheckout = document.getElementById('cancel-checkout');
  const orderForm = document.getElementById('order-form');

  // Toggle Drawer
  const openCart = () => {
    renderCartDrawer();
    drawerOverlay.classList.add('active');
    cartDrawer.classList.add('active');
  };

  const closeCart = () => {
    drawerOverlay.classList.remove('active');
    cartDrawer.classList.remove('active');
    checkoutModal.classList.remove('active');
  };

  cartBar.addEventListener('click', openCart);
  closeDrawer.addEventListener('click', closeCart);
  drawerOverlay.addEventListener('click', closeCart);

  // Toggle Checkout Modal
  checkoutBtn.addEventListener('click', () => {
    checkoutModal.classList.add('active');
  });

  closeCheckout.addEventListener('click', () => checkoutModal.classList.remove('active'));
  cancelCheckout.addEventListener('click', () => checkoutModal.classList.remove('active'));

  // Place Order Action
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const customerName = document.getElementById('cust-name').value.trim();
    const customerPhone = document.getElementById('cust-phone').value.trim();

    if (!customerName || !customerPhone) {
      showToast('Please enter your name and phone number', 'error');
      return;
    }

    if (!/^\d{10}$/.test(customerPhone)) {
      showToast('Please enter a valid 10-digit phone number', 'error');
      return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const orderData = {
      customerName,
      customerPhone,
      tableNumber: tableNumber || 'Takeaway',
      items: cart,
      total
    };

    try {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Placing Order...';

      const placedOrder = await API.placeOrder(orderData);
      
      showToast('Order placed successfully!', 'success');
      
      // Store active order ID for live tracking
      activeOrderId = placedOrder.id;
      localStorage.setItem('lassi_active_order_id', placedOrder.id);
      
      // Reset Cart
      cart = [];
      localStorage.removeItem('lassi_cart');
      updateCartBadge();
      updateCartBar();
      renderMenu();

      // Close all modals
      closeCart();
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = 'Place Order <i data-lucide="arrow-right"></i>';
      lucide.createIcons();

      // Show Tracker and Start Polling
      showOrderTracker();
      startTrackingOrder();
      
      // Scroll to tracker
      document.getElementById('order-tracker').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
      showToast('Failed to place order. Try again.', 'error');
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = 'Place Order <i data-lucide="arrow-right"></i>';
      lucide.createIcons();
    }
  });
}

// 9. Order Status Polling & Rendering
function showOrderTracker() {
  document.getElementById('order-tracker').style.display = 'block';
}

function hideOrderTracker() {
  document.getElementById('order-tracker').style.display = 'none';
  localStorage.removeItem('lassi_active_order_id');
  activeOrderId = null;
  if (statusInterval) clearInterval(statusInterval);
}

function startTrackingOrder() {
  if (statusInterval) clearInterval(statusInterval);
  
  // Initial check
  pollOrderStatus();
  
  // Poll every 4 seconds
  statusInterval = setInterval(pollOrderStatus, 4000);
}

async function pollOrderStatus() {
  if (!activeOrderId) return;
  
  try {
    const orders = await API.getOrders();
    const activeOrder = orders.find(o => o.id === activeOrderId);
    
    if (!activeOrder) {
      // Order deleted or not found
      hideOrderTracker();
      return;
    }
    
    renderOrderTracker(activeOrder);
    
    // Stop polling if completed
    if (activeOrder.status === 'Completed') {
      clearInterval(statusInterval);
      showToast('Order completed! Hope you enjoy your meal.', 'success');
    }
  } catch (error) {
    console.error('Error polling order status:', error);
  }
}

function renderOrderTracker(order) {
  const container = document.getElementById('order-tracker');
  const statusLabels = {
    'Pending': 'Order Placed',
    'Preparing': 'In the Kitchen',
    'Ready': 'Ready to Pick Up',
    'Completed': 'Served & Completed'
  };

  const currentStatus = order.status; // Pending -> Preparing -> Ready -> Completed
  let progressWidth = '0%';
  let activeIndex = 0;

  if (currentStatus === 'Pending') {
    progressWidth = '0%';
    activeIndex = 0;
  } else if (currentStatus === 'Preparing') {
    progressWidth = '33%';
    activeIndex = 1;
  } else if (currentStatus === 'Ready') {
    progressWidth = '66%';
    activeIndex = 2;
  } else if (currentStatus === 'Completed') {
    progressWidth = '100%';
    activeIndex = 3;
  }

  // Generate Items markup
  const itemsHtml = order.items.map(item => `
    <div class="tracker-item-row">
      <span>${item.name} <strong style="color:var(--color-orange)">x${item.qty}</strong></span>
      <span>₹${item.price * item.qty}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="order-tracker-container">
      <div class="tracker-header">
        <div>
          <span class="tracker-number">Order #${order.orderNumber}</span>
          <div style="font-size:0.75rem; color:var(--color-text-muted)">Table: ${order.tableNumber}</div>
        </div>
        <span class="badge ${getBadgeClass(currentStatus)}">
          ${currentStatus === 'Preparing' || currentStatus === 'Pending' ? '<span class="pulse-spinner"></span>' : ''}
          ${statusLabels[currentStatus]}
        </span>
      </div>

      <div class="progress-steps">
        <div class="progress-line">
          <div class="progress-line-fill" style="width: ${progressWidth}"></div>
        </div>
        
        <div class="step-node ${activeIndex >= 0 ? (activeIndex > 0 ? 'completed' : 'active') : ''}">
          <div class="step-circle">${activeIndex > 0 ? '✓' : '1'}</div>
          <span class="step-label">Placed</span>
        </div>
        
        <div class="step-node ${activeIndex >= 1 ? (activeIndex > 1 ? 'completed' : 'active') : ''}">
          <div class="step-circle">${activeIndex > 1 ? '✓' : '2'}</div>
          <span class="step-label">Preparing</span>
        </div>
        
        <div class="step-node ${activeIndex >= 2 ? (activeIndex > 2 ? 'completed' : 'active') : ''}">
          <div class="step-circle">${activeIndex > 2 ? '✓' : '3'}</div>
          <span class="step-label">Ready</span>
        </div>
        
        <div class="step-node ${activeIndex >= 3 ? 'completed' : ''}">
          <div class="step-circle">${activeIndex >= 3 ? '✓' : '4'}</div>
          <span class="step-label">Served</span>
        </div>
      </div>

      <div class="tracker-items">
        <div style="font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Order Summary</div>
        ${itemsHtml}
        <div class="tracker-total-row">
          <span>Total paid (cash/counter)</span>
          <span>₹${order.total}</span>
        </div>
      </div>

      ${currentStatus === 'Completed' ? `
        <button class="btn btn-secondary btn-sm" id="clear-tracker-btn" style="width:100%">
          Close Tracker
        </button>
      ` : ''}
    </div>
  `;

  // Attach clear tracker action if order is completed
  const clearBtn = document.getElementById('clear-tracker-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', hideOrderTracker);
  }
}

function getBadgeClass(status) {
  switch (status) {
    case 'Pending': return 'badge-pending';
    case 'Preparing': return 'badge-preparing';
    case 'Ready': return 'badge-ready';
    case 'Completed': return 'badge-completed';
    default: return '';
  }
}

// 10. Custom Toast Notifications
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

  // Fade out and remove
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}
