'use strict';

const STORAGE_KEY = 'china_po_system_cfg_v1';
const ADMIN_SESSION_KEY = 'china_po_admin_unlocked';
const ADMIN_PASSWORD = 'SYSTEM';

// 部署好 Google Apps Script 后，把 Web App URL 填在这里，所有访客（只读）都能直接看到真实数据
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbz_ACN-CR159vMitBjx2LMPJd3zb8cwAnuKMiNDcAr0-W4Igp0tiSGzoEEO3IFoOVtK/exec';

const DEMO_ORDERS = [
  {
    rowIndex: 81,
    date: '2026-11-17',
    itemSummary: 'JOSHI LIGHT CLAY',
    vendor: 'JOSHI',
    shipping: 'LBS-义乌',
    warehouseReceiptLinks: '',
    poNo: '0008755',
    cartons: 50,
    poLink: 'https://docs.google.com/spreadsheets/d/1m3YjCAeEsdggddiZLkPkqb64aotjc5n-/edit',
    poAmount: 7847,
    deposit: 0,
    payment2: 0,
    pendingRmb: 7847,
    myr: '',
    paymentDate: '',
    paymentVoucher: '',
    paymentSlipLinks: '',
    statusPayment: 'PENDING',
    statusDelivery: 'VENDOR BELUM HANTAR',
    invoiceLinks: ''
  },
  {
    rowIndex: 80,
    date: '2026-11-17',
    itemSummary: 'XILAMI 西拉米 squishy ball',
    vendor: '西拉米',
    shipping: 'LBS-义乌',
    warehouseReceiptLinks: 'https://drive.google.com/file/d/1EBP_3bfo1VKrNx-v80w5PL4srVN2ii0x/view',
    poNo: '0008738-0008739',
    cartons: 23,
    poLink: 'https://docs.google.com/spreadsheets/d/1NtBirTMqH_PADzOlGP0adKDChVKXh2zp/edit',
    poAmount: 13430.4,
    deposit: 0,
    payment2: 0,
    pendingRmb: 13430.4,
    myr: '',
    paymentDate: '',
    paymentVoucher: '',
    paymentSlipLinks: '',
    statusPayment: 'PENDING',
    statusDelivery: 'DI GUDANG TRANSPORT',
    invoiceLinks: ''
  },
  {
    rowIndex: 3,
    date: '2025-02-01',
    itemSummary: 'CORENTION TAPE',
    vendor: 'DGG',
    shipping: 'TNLGHCMEN-义乌',
    warehouseReceiptLinks: 'https://drive.google.com/file/d/1qIV43D_rF5aFeOAk8gY4sVHa2DD3USqd/view',
    poNo: 'TNLDGG071224',
    cartons: 75,
    poLink: 'https://docs.google.com/spreadsheets/d/1WQpi-jJp96240cGKcMe7yyNlHrK_Go2G/edit',
    poAmount: 55072.8,
    deposit: 0,
    payment2: 55072.8,
    pendingRmb: 0,
    myr: 34276.79,
    paymentDate: '2025-02-13',
    paymentVoucher: 'PV2502-094',
    paymentSlipLinks: 'https://drive.google.com/file/d/1Mx35LWv0tRG94nHmnsUBoROIcI164stQ/view',
    statusPayment: 'DONE',
    statusDelivery: 'COMPLETE',
    invoiceLinks: ''
  }
];

const state = {
  cfg: loadConfig(),
  isAdmin: localStorage.getItem(ADMIN_SESSION_KEY) === '1',
  orders: [],
  vendors: [],
  shippings: []
};

/* ==================== 初始化 ==================== */
document.addEventListener('DOMContentLoaded', () => {
  initDialogFallbacks();
  bindEvents();
  updateConnectionUI();
  updateAdminUI();
  setDefaultNewOrderDate();
  updateShippingPreview();
  loadOrders();
});

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { gasUrl: '', pin: '' };
  } catch {
    return { gasUrl: '', pin: '' };
  }
}

function saveConfig(cfg) {
  state.cfg = cfg;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  updateConnectionUI();
}

function getGasUrl() {
  return (state.cfg.gasUrl || DEFAULT_GAS_URL || '').trim();
}

function isLiveMode() {
  return getGasUrl().startsWith('https://');
}

function updateConnectionUI() {
  const badge = document.getElementById('connection-badge');
  const banner = document.getElementById('setup-banner');
  if (isLiveMode()) {
    badge.textContent = '已连接 Google';
    badge.className = 'status-pill status-live';
    banner.hidden = true;
  } else {
    badge.textContent = '演示模式';
    badge.className = 'status-pill status-demo';
    banner.hidden = false;
  }
}

/* ==================== Dialog 辅助（含 closedby 兼容） ==================== */
function initDialogFallbacks() {
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      dialog.returnValue = '';
    });
  });

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    document.querySelectorAll('dialog[closedby="any"]').forEach((dialog) => {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    });
  }
}

/* ==================== 事件绑定 ==================== */
function bindEvents() {
  document.getElementById('btn-admin-lock').addEventListener('click', toggleAdminLock);
  document.getElementById('admin-form').addEventListener('submit', handleAdminUnlock);
  document.getElementById('btn-refresh').addEventListener('click', loadOrders);
  document.getElementById('btn-settings').addEventListener('click', openSettingsDialog);
  document.getElementById('btn-banner-settings').addEventListener('click', () => {
    if (!state.isAdmin) {
      openAdminDialog();
      showToast('请先解锁 Admin 权限再配置连接');
      return;
    }
    openSettingsDialog();
  });
  document.getElementById('btn-new-order').addEventListener('click', openNewOrderDialog);

  document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-close-dialog');
      document.getElementById(id).close();
    });
  });

  // 搜索与筛选
  ['search-input', 'filter-shipping', 'filter-payment', 'filter-delivery'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderTable);
    document.getElementById(id).addEventListener('change', renderTable);
  });

  // 模板或地区变化时自动更新 SHIPPING 预览
  document.getElementById('new-template').addEventListener('change', updateShippingPreview);
  document.getElementById('new-region').addEventListener('change', updateShippingPreview);

  // 上传单据类型切换时显示/隐藏订金货款选项
  document.getElementById('upload-doc-type').addEventListener('change', toggleUploadTypeFields);

  // 表单提交
  document.getElementById('new-order-form').addEventListener('submit', handleCreateOrder);
  document.getElementById('upload-form').addEventListener('submit', handleUploadFiles);
  document.getElementById('edit-form').addEventListener('submit', handleUpdateOrder);
  document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);
  document.getElementById('btn-clear-cfg').addEventListener('click', () => {
    saveConfig({ gasUrl: '' });
    document.getElementById('settings-dialog').close();
    loadOrders();
    showToast(DEFAULT_GAS_URL ? '已恢复默认连接' : '已切换回本地演示模式');
  });
}

function setDefaultNewOrderDate() {
  // 用本地时区日期（toISOString 是 UTC，马来西亚早上 8 点前会变成昨天）
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  document.getElementById('new-date').value = `${y}-${m}-${d}`;
}

function updateShippingPreview() {
  const tpl = document.getElementById('new-template').value;
  const region = document.getElementById('new-region').value;
  const shippingInput = document.getElementById('new-shipping');
  if (tpl === 'TNL') {
    shippingInput.value = `TNLGHCMEN-${region}`;
  } else {
    shippingInput.value = `LBS-${region}`;
  }
}

/* ==================== API 请求 ==================== */
async function callGas(action, payload = {}) {
  const res = await fetch(getGasUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action,
      // 只读访客不带密码；Admin 解锁后带上密码，后端会二次校验写入权限
      pin: state.isAdmin ? ADMIN_PASSWORD : '',
      ...payload
    })
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

async function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">正在读取订单数据...</td></tr>';

  try {
    if (isLiveMode()) {
      const data = await callGas('listOrders');
      state.orders = data.orders || [];
      state.vendors = data.vendors || [];
      state.shippings = data.shippings || [];
    } else {
      state.orders = structuredClone(DEMO_ORDERS);
      state.vendors = [...new Set(state.orders.map((o) => o.vendor).filter(Boolean))];
      state.shippings = [...new Set(state.orders.map((o) => o.shipping).filter(Boolean))];
    }

    populateDatalistAndFilters();
    renderKpis();
    renderTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-cell">加载失败：${escapeHtml(err.message)}</td></tr>`;
    showToast('加载失败: ' + err.message);
  }
}

function populateDatalistAndFilters() {
  const dl = document.getElementById('vendor-datalist');
  dl.innerHTML = '';
  state.vendors.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    dl.appendChild(opt);
  });

  const shipSelect = document.getElementById('filter-shipping');
  const current = shipSelect.value;
  shipSelect.innerHTML = '<option value="">全部物流 (Shipping)</option>';
  state.shippings.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    shipSelect.appendChild(opt);
  });
  shipSelect.value = current;
}

/* ==================== 渲染 KPI & 表格 ==================== */
function renderKpis(rows = getFilteredOrders()) {
  const total = rows.length;
  let pendingRmb = 0;
  let unpaid = 0;
  let undelivered = 0;

  rows.forEach((o) => {
    const pend = Number(o.pendingRmb);
    if (!isNaN(pend) && pend > 0) pendingRmb += pend;
    if (String(o.statusPayment).toUpperCase() !== 'DONE') unpaid++;
    if (String(o.statusDelivery).toUpperCase() !== 'COMPLETE') undelivered++;
  });

  document.getElementById('kpi-total').textContent = String(total);
  document.getElementById('kpi-pending-rmb').textContent =
    '¥' + pendingRmb.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('kpi-unpaid').textContent = String(unpaid);
  document.getElementById('kpi-undelivered').textContent = String(undelivered);
}

function getFilteredOrders() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const ship = document.getElementById('filter-shipping').value;
  const pay = document.getElementById('filter-payment').value;
  const deliv = document.getElementById('filter-delivery').value;

  return state.orders.filter((o) => {
    if (ship && o.shipping !== ship) return false;
    if (pay && (o.statusPayment || 'PENDING').toUpperCase() !== pay) return false;
    if (deliv && (o.statusDelivery || '').toUpperCase() !== deliv) return false;
    if (q) {
      const hay = `${o.poNo} ${o.vendor} ${o.itemSummary} ${o.shipping}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderTable() {
  const tbody = document.getElementById('orders-tbody');
  const rows = getFilteredOrders();
  renderKpis(rows);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">没有符合条件的订单</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  rows.forEach((order) => {
    const tr = document.createElement('tr');
    const payStatus = (order.statusPayment || 'PENDING').toUpperCase();
    const delStatus = order.statusDelivery || 'PENDING';
    const isComplete = payStatus === 'DONE' && delStatus.toUpperCase() === 'COMPLETE';
    tr.className = isComplete ? 'row-complete' : 'row-pending';

    // Sticky Row Header: PO No
    const th = document.createElement('th');
    th.scope = 'row';
    th.className = 'col-po';
    th.textContent = order.poNo || '(无单号)';
    tr.appendChild(th);

    tr.appendChild(makeCell('日期', formatShortDate(order.date) || '-', 'col-date'));
    tr.appendChild(makeCell('供应商', order.vendor || '-', 'col-vendor'));
    tr.appendChild(makeCell('货品摘要', order.itemSummary || '-', 'col-summary'));

    // 物流标签
    const shipTd = document.createElement('td');
    shipTd.setAttribute('data-label', '物流');
    shipTd.className = 'col-shipping';
    if (order.shipping) {
      const shipSpan = document.createElement('span');
      const isLbs = String(order.shipping).toUpperCase().includes('LBS');
      shipSpan.className = `ship-tag ${isLbs ? 'ship-lbs' : 'ship-tnl'}`;
      shipSpan.textContent = order.shipping;
      shipTd.appendChild(shipSpan);
    } else {
      shipTd.textContent = '-';
    }
    tr.appendChild(shipTd);

    tr.appendChild(
      makeCell('件数', order.cartons !== '' && order.cartons !== undefined ? String(order.cartons) : '-', 'col-cartons')
    );

    // 金额/待付
    const amountTd = document.createElement('td');
    amountTd.setAttribute('data-label', '金额 / 待付');
    amountTd.className = 'col-amount';
    const amtText = order.poAmount !== '' ? `总额: ${formatRmb(order.poAmount)}` : '总额: -';
    const pendNum = Number(order.pendingRmb);
    const hasPend = order.pendingRmb !== '' && !isNaN(pendNum);
    const pendText = hasPend ? `待付: ${formatRmb(pendNum)}` : '待付: -';
    const pendClass = hasPend && pendNum > 0 ? 'amount-pending' : 'amount-cleared';
    amountTd.innerHTML = `<div class="amount-total">${escapeHtml(amtText)}</div><div class="${pendClass}">${escapeHtml(pendText)}</div>`;
    tr.appendChild(amountTd);

    // 状态列
    const statusTd = document.createElement('td');
    statusTd.setAttribute('data-label', '付款 / 物流');
    statusTd.className = 'col-status';
    const payClass = payStatus === 'DONE' ? 'badge-done' : 'badge-pending';
    const delClass = delStatus.toUpperCase() === 'COMPLETE' ? 'badge-done' : 'badge-pending';
    statusTd.innerHTML = `
      <div><span class="badge ${payClass}">${escapeHtml(payStatus)}</span></div>
      <div style="margin-top:4px"><span class="badge ${delClass}">${escapeHtml(delStatus)}</span></div>
    `;
    tr.appendChild(statusTd);

    // Google Drive 链接列
    const linksTd = document.createElement('td');
    linksTd.setAttribute('data-label', '单据链接');
    linksTd.className = 'col-links';
    const stack = document.createElement('div');
    stack.className = 'links-stack';

    appendLinkChips(stack, order.poLink, 'PO表', 'po');
    appendLinkChips(stack, order.paymentSlipLinks, '水单');
    appendLinkChips(stack, order.warehouseReceiptLinks, '入库单');

    if (!stack.children.length) {
      const emptySpan = document.createElement('span');
      emptySpan.className = 'hint';
      emptySpan.textContent = '暂无';
      stack.appendChild(emptySpan);
    }
    linksTd.appendChild(stack);
    tr.appendChild(linksTd);

    // 操作列
    const actTd = document.createElement('td');
    actTd.setAttribute('data-label', '操作');
    actTd.className = 'col-actions';
    if (state.isAdmin) {
      const actWrap = document.createElement('div');
      actWrap.className = 'row-actions';

      const btnUpload = document.createElement('button');
      btnUpload.type = 'button';
      btnUpload.className = 'btn btn-secondary btn-sm';
      btnUpload.textContent = '📎 上传';
      btnUpload.addEventListener('click', () => openUploadDialog(order));

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-secondary btn-sm';
      btnEdit.textContent = '✎ 状态';
      btnEdit.addEventListener('click', () => openEditDialog(order));

      actWrap.appendChild(btnUpload);
      actWrap.appendChild(btnEdit);
      actTd.appendChild(actWrap);
    } else {
      const readonlyTag = document.createElement('span');
      readonlyTag.className = 'hint';
      readonlyTag.textContent = '🔒 仅查看';
      actTd.appendChild(readonlyTag);
    }
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  });
}

function makeCell(label, text, className = '') {
  const td = document.createElement('td');
  td.setAttribute('data-label', label);
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

function appendLinkChips(container, rawLinks, label, extraClass = '') {
  if (!rawLinks) return;
  const parts = String(rawLinks)
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith('http'));

  parts.forEach((url, idx) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = `doc-chip ${extraClass}`.trim();
    const isFolder = url.includes('/folders/');
    const prefix = isFolder ? '📁 ' : '';
    a.textContent = parts.length > 1 ? `${prefix}${label}${idx + 1}` : `${prefix}${label}`;
    container.appendChild(a);
  });
}

/* ==================== Admin 锁 ==================== */
function updateAdminUI() {
  const lockBtn = document.getElementById('btn-admin-lock');
  document.querySelectorAll('.admin-only').forEach((el) => {
    el.hidden = !state.isAdmin;
  });

  if (state.isAdmin) {
    lockBtn.textContent = '🔓 Logout Admin';
    lockBtn.classList.add('btn-unlocked');
  } else {
    lockBtn.textContent = '🔒 Admin 登录';
    lockBtn.classList.remove('btn-unlocked');
  }
}

function toggleAdminLock() {
  if (state.isAdmin) {
    state.isAdmin = false;
    localStorage.removeItem(ADMIN_SESSION_KEY);
    updateAdminUI();
    renderTable();
    showToast('已退出 Admin，切换回只读模式');
  } else {
    openAdminDialog();
  }
}

function openAdminDialog() {
  document.getElementById('admin-form').reset();
  document.getElementById('admin-error').hidden = true;
  document.getElementById('admin-dialog').showModal();
}

function handleAdminUnlock(e) {
  e.preventDefault();
  const input = document.getElementById('admin-password-input').value;
  if (input === ADMIN_PASSWORD) {
    state.isAdmin = true;
    localStorage.setItem(ADMIN_SESSION_KEY, '1');
    document.getElementById('admin-dialog').close();
    updateAdminUI();
    renderTable();
    showToast('Admin 已解锁，可进行建单与上传操作');
  } else {
    document.getElementById('admin-error').hidden = false;
  }
}

/* ==================== 新建订单 ==================== */
function openNewOrderDialog() {
  if (!state.isAdmin) return openAdminDialog();
  document.getElementById('new-order-form').reset();
  document.getElementById('new-region').value = '义乌';
  setDefaultNewOrderDate();
  updateShippingPreview();
  document.getElementById('new-order-result').hidden = true;
  document.getElementById('new-order-dialog').showModal();
}

async function handleCreateOrder(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-create-submit');
  btn.disabled = true;
  btn.textContent = '正在复制模板并创建...';

  try {
    const attachments = [
      ...(await readFilesAsPayload('new-file-payment', 'payment_slip')),
      ...(await readFilesAsPayload('new-file-warehouse', 'warehouse_receipt'))
    ];

    const payload = {
      templateType: document.getElementById('new-template').value,
      region: document.getElementById('new-region').value,
      shipping: document.getElementById('new-shipping').value.trim(),
      poNo: document.getElementById('new-po-no').value.trim(),
      date: document.getElementById('new-date').value,
      vendor: document.getElementById('new-vendor').value.trim(),
      cartons: document.getElementById('new-cartons').value,
      itemSummary: document.getElementById('new-item-summary').value.trim(),
      poAmount: document.getElementById('new-amount').value,
      statusDelivery: document.getElementById('new-delivery-status').value,
      attachments
    };

    let poUrl = '';
    let poFolderUrl = '';
    let fileName = '';

    if (isLiveMode()) {
      const res = await callGas('createOrder', payload);
      poUrl = res.poUrl;
      poFolderUrl = res.poFolderUrl || res.poUrl;
      fileName = res.fileName;
      await loadOrders();
    } else {
      // 演示模式模拟
      poUrl = 'https://docs.google.com/spreadsheets/d/DEMO_NEW_SHEET/edit';
      poFolderUrl = 'https://drive.google.com/drive/folders/DEMO_PO_SUBFOLDER_' + payload.poNo;
      fileName = `${payload.poNo} - ${payload.vendor || '新供应商'} - ${payload.templateType} - ${payload.region}`;
      state.orders.unshift({
        rowIndex: Date.now(),
        date: payload.date,
        itemSummary: payload.itemSummary,
        vendor: payload.vendor,
        shipping: payload.shipping,
        warehouseReceiptLinks: attachments.some((a) => a.docType === 'warehouse_receipt') ? 'https://drive.google.com/drive/folders/DEMO_INBOUND' : '',
        poNo: payload.poNo,
        cartons: payload.cartons,
        poLink: poFolderUrl,
        poAmount: payload.poAmount ? Number(payload.poAmount) : '',
        deposit: 0,
        payment2: 0,
        pendingRmb: payload.poAmount ? Number(payload.poAmount) : '',
        myr: '',
        paymentDate: '',
        paymentVoucher: '',
        paymentSlipLinks: attachments.some((a) => a.docType === 'payment_slip') ? 'https://drive.google.com/demo-payment' : '',
        statusPayment: 'PENDING',
        statusDelivery: payload.statusDelivery
      });
      renderKpis();
      renderTable();
    }

    document.getElementById('new-order-filename').textContent = `文件名：${fileName}`;
    document.getElementById('new-order-sheet-link').href = poUrl;
    document.getElementById('new-order-folder-link').href = poFolderUrl;
    document.getElementById('new-order-result').hidden = false;
    showToast('订单创建成功！请点击链接打开 Google Sheet 填写明细');
  } catch (err) {
    showToast('创建失败: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '创建订单并生成链接';
  }
}

/* ==================== 上传单据 ==================== */
function toggleUploadTypeFields() {
  const docType = document.getElementById('upload-doc-type').value;
  const isPayment = docType === 'payment_slip';
  document.getElementById('upload-payment-fields').hidden = !isPayment;
  document.getElementById('upload-stage-field').hidden = isPayment;
}

function openUploadDialog(order) {
  if (!state.isAdmin) return openAdminDialog();
  document.getElementById('upload-form').reset();
  document.getElementById('upload-row-index').value = order.rowIndex;
  document.getElementById('upload-order-info').textContent =
    `PO: ${order.poNo || '-'}  |  供应商: ${order.vendor || '-'}  |  物流: ${order.shipping || '-'}`;

  // 默认填今天日期 dd/MM/yyyy
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  document.getElementById('upload-pay-date').value = `${dd}/${mm}/${now.getFullYear()}`;
  toggleUploadTypeFields();

  const existingBox = document.getElementById('upload-existing-links');
  existingBox.innerHTML = '';
  const items = [
    ['已有水单 (P列)', order.paymentSlipLinks],
    ['已有入库单 (E列)', order.warehouseReceiptLinks]
  ];
  items.forEach(([label, val]) => {
    const line = document.createElement('div');
    line.textContent = `${label}: ${val ? val.split(/[;,]/).length + ' 个链接' : '无'}`;
    existingBox.appendChild(line);
  });

  document.getElementById('upload-dialog').showModal();
}

async function handleUploadFiles(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-upload-submit');
  btn.disabled = true;
  btn.textContent = '正在上传到 Google Drive...';

  try {
    const rowIndex = Number(document.getElementById('upload-row-index').value);
    const docType = document.getElementById('upload-doc-type').value;
    const files = await readFilesAsPayload('upload-files-input', docType);

    if (!files.length) {
      throw new Error('请先选择文件');
    }

    const paymentKind = document.getElementById('upload-payment-kind').value;
    const paymentAmountRmb = document.getElementById('upload-pay-rmb').value;
    const paymentAmountMyr = document.getElementById('upload-pay-myr').value;
    const paymentDate = document.getElementById('upload-pay-date').value.trim();
    const paymentVoucher = document.getElementById('upload-pay-voucher').value.trim();
    const markPaymentDone = document.getElementById('upload-mark-done').checked;

    const stageTag = docType === 'payment_slip'
      ? (paymentKind === 'deposit' ? '订金' : paymentKind === 'balance' ? '货款' : '')
      : document.getElementById('upload-stage-tag').value.trim();

    if (isLiveMode()) {
      const order = state.orders.find((o) => o.rowIndex === rowIndex);
      await callGas('uploadFiles', {
        rowIndex,
        poNo: order ? order.poNo : '',
        docType,
        stageTag,
        paymentKind,
        paymentAmountRmb,
        paymentAmountMyr,
        paymentDate,
        paymentVoucher,
        markPaymentDone,
        files
      });
      await loadOrders();
    } else {
      const target = state.orders.find((o) => o.rowIndex === rowIndex);
      if (target) {
        const fakeSubfolderUrl = 'https://drive.google.com/drive/folders/DEMO_SUBFOLDER_' + (target.poNo || rowIndex);
        if (docType === 'payment_slip') {
          target.paymentSlipLinks = fakeSubfolderUrl;
          const rmb = Number(paymentAmountRmb) || 0;
          if (rmb > 0 && paymentKind !== 'upload_only') {
            if (paymentKind === 'deposit') target.deposit = (Number(target.deposit) || 0) + rmb;
            else target.payment2 = (Number(target.payment2) || 0) + rmb;
            target.pendingRmb = (Number(target.poAmount) || 0) - (Number(target.deposit) || 0) - (Number(target.payment2) || 0);
          }
          if (markPaymentDone) target.statusPayment = 'DONE';
        } else if (docType === 'warehouse_receipt') {
          target.warehouseReceiptLinks = fakeSubfolderUrl;
        }
        renderKpis();
        renderTable();
      }
    }

    document.getElementById('upload-dialog').close();
    showToast('已上传到该 PO 专属子文件夹并更新总表！');
  } catch (err) {
    showToast('上传失败: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '开始上传到 Google Drive';
  }
}

/* ==================== 更新付款与状态 ==================== */
function openEditDialog(order) {
  if (!state.isAdmin) return openAdminDialog();
  document.getElementById('edit-row-index').value = order.rowIndex;
  document.getElementById('edit-order-info').textContent =
    `PO: ${order.poNo || '-'}  |  供应商: ${order.vendor || '-'}`;

  document.getElementById('edit-po-amount').value = order.poAmount;
  document.getElementById('edit-deposit').value = order.deposit;
  document.getElementById('edit-payment2').value = order.payment2;
  document.getElementById('edit-myr').value = order.myr;
  document.getElementById('edit-payment-date').value = formatShortDate(order.paymentDate) || '';
  document.getElementById('edit-voucher').value = order.paymentVoucher || '';
  document.getElementById('edit-status-payment').value = (order.statusPayment || 'PENDING').toUpperCase();
  document.getElementById('edit-status-delivery').value = order.statusDelivery || 'VENDOR BELUM HANTAR';
  document.getElementById('edit-cartons').value = order.cartons ?? '';

  document.getElementById('edit-dialog').showModal();
}

async function handleUpdateOrder(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-edit-submit');
  btn.disabled = true;
  btn.textContent = '正在保存...';

  try {
    const rowIndex = Number(document.getElementById('edit-row-index').value);
    const editingOrder = state.orders.find((o) => o.rowIndex === rowIndex);
    const payload = {
      rowIndex,
      expectedPoNo: editingOrder ? editingOrder.poNo : '',
      poAmount: numOrEmpty(document.getElementById('edit-po-amount').value),
      deposit: numOrEmpty(document.getElementById('edit-deposit').value),
      payment2: numOrEmpty(document.getElementById('edit-payment2').value),
      myr: numOrEmpty(document.getElementById('edit-myr').value),
      paymentDate: document.getElementById('edit-payment-date').value.trim(),
      paymentVoucher: document.getElementById('edit-voucher').value.trim(),
      statusPayment: document.getElementById('edit-status-payment').value,
      statusDelivery: document.getElementById('edit-status-delivery').value,
      cartons: document.getElementById('edit-cartons').value.trim()
    };

    if (isLiveMode()) {
      await callGas('updateOrder', payload);
      await loadOrders();
    } else {
      const target = state.orders.find((o) => o.rowIndex === rowIndex);
      if (target) {
        Object.assign(target, payload);
        target.pendingRmb = (Number(payload.poAmount) || 0) - (Number(payload.deposit) || 0) - (Number(payload.payment2) || 0);
        renderKpis();
        renderTable();
      }
    }

    document.getElementById('edit-dialog').close();
    showToast('订单状态已更新');
  } catch (err) {
    showToast('更新失败: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '保存更新';
  }
}

/* ==================== 设置 ==================== */
function openSettingsDialog() {
  if (!state.isAdmin) return openAdminDialog();
  document.getElementById('cfg-gas-url').value = getGasUrl();
  document.getElementById('settings-dialog').showModal();
}

function handleSaveSettings(e) {
  e.preventDefault();
  const gasUrl = document.getElementById('cfg-gas-url').value.trim();
  saveConfig({ gasUrl });
  document.getElementById('settings-dialog').close();
  loadOrders();
  showToast('设置已保存，正在连接 Google Sheets...');
}

/* ==================== 工具函数 ==================== */
function readFilesAsPayload(inputId, docType) {
  const input = document.getElementById(inputId);
  const files = Array.from(input.files || []);
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve({
              docType,
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              base64
            });
          };
          reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
          reader.readAsDataURL(file);
        })
    )
  );
}

function numOrEmpty(val) {
  if (val === '' || val === null || val === undefined) return '';
  const n = Number(val);
  return isNaN(n) ? '' : n;
}

/**
 * 将各种长日期（如 "Mon Nov 16 2026 00:00:00 GMT+0800..." 或 "2026-11-16"）统一格式化为简短 DD/MM/YYYY
 */
function formatShortDate(raw) {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // 如果已经是 16/11/2026 或多笔 12/12/2024,19/02/2025 格式，直接保留
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}(\s*,\s*\d{1,2}\/\d{1,2}\/\d{2,4})*$/.test(str)) {
    return str;
  }

  // 如果是 YYYY-MM-DD 格式
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  // 解析 JS 长日期字符串（如 "Mon Nov 16 2026 00:00:00 GMT+0800..."）或 ISO 时间戳
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return str;
}

function formatRmb(val) {
  const n = Number(val);
  if (isNaN(n)) return '-';
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}
