'use strict';

const STORAGE_KEY = 'china_po_system_cfg_v1';
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbz_ACN-CR159vMitBjx2LMPJd3zb8cwAnuKMiNDcAr0-W4Igp0tiSGzoEEO3IFoOVtK/exec';

const DEMO_ORDERS = [
  {
    rowIndex: 81,
    date: '17/11/2026',
    itemSummary: 'JOSHI LIGHT CLAY',
    vendor: 'JOSHI',
    shipping: 'LBS-义乌',
    warehouseReceiptLinks: '',
    poNo: '0008755',
    cartons: 50,
    poLink: 'https://docs.google.com/spreadsheets/d/1m3YjCAeEsdggddiZLkPkqb64aotjc5n-/edit',
    poAmount: 7847,
    statusPayment: 'PENDING',
    chinaBank: '中国农业银行 6228 4803 8284 6815 217 户名：JOSHI'
  },
  {
    rowIndex: 80,
    date: '17/11/2026',
    itemSummary: 'XILAMI 西拉米 squishy ball',
    vendor: '西拉米',
    shipping: 'LBS-义乌',
    warehouseReceiptLinks: 'https://drive.google.com/file/d/1EBP_3bfo1VKrNx-v80w5PL4srVN2ii0x/view',
    poNo: '0008738-0008739',
    cartons: 23,
    poLink: 'https://docs.google.com/spreadsheets/d/1NtBirTMqH_PADzOlGP0adKDChVKXh2zp/edit',
    poAmount: 13430.4,
    statusPayment: 'PENDING',
    chinaBank: '建设银行：6227001463600056339 户名：朱明红 开户行：浙江自贸区义乌支行'
  },
  {
    rowIndex: 60,
    date: '28/09/2026',
    itemSummary: 'DGG STATIONERY',
    vendor: 'DGG',
    shipping: 'TNLGHCMEN',
    warehouseReceiptLinks: 'https://drive.google.com/file/d/1NZ-TGviAKZQrjILyhWPRpDusSzfaObsV/view',
    poNo: 'TNLDGG261021',
    cartons: 110,
    poLink: 'https://docs.google.com/spreadsheets/d/19PnShe1j_0KuPM8W2XpAE1pGWgq7J3eG/edit',
    poAmount: 34123.48,
    statusPayment: 'PENDING',
    chinaBank: '中行：6217856200061259292 户名：吴航'
  },
  {
    rowIndex: 3,
    date: '01/02/2025',
    itemSummary: 'CORENTION TAPE',
    vendor: 'DGG',
    shipping: 'TNLGHCMEN-义乌',
    warehouseReceiptLinks: 'https://drive.google.com/file/d/1qIV43D_rF5aFeOAk8gY4sVHa2DD3USqd/view',
    poNo: 'TNLDGG071224',
    cartons: 75,
    poLink: 'https://docs.google.com/spreadsheets/d/1WQpi-jJp96240cGKcMe7yyNlHrK_Go2G/edit',
    poAmount: 55072.8,
    statusPayment: 'DONE',
    chinaBank: '中行：6217856200061259292 户名：吴航'
  }
];

const PARTNER_CODE = String(document.body.dataset.partner || 'TNL').toUpperCase();

const state = {
  orders: [],
  shippings: []
};

/* ==================== 一键复制 (Invoker Commands + Clipboard Fallback) ==================== */
const copyTimers = new WeakMap();
let lastCopyMessage = '';

function legacyCopyText(text) {
  const field = Object.assign(document.createElement('textarea'), { value: text });
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } finally {
    field.remove();
  }
}

function reportCopyResult(button, ok) {
  const tip = button.nextElementSibling;
  clearTimeout(copyTimers.get(button));
  button.removeAttribute('data-copied');
  button.removeAttribute('data-failed');
  let message = ok ? '已复制' : '复制失败';
  if (message === lastCopyMessage) message += '\u00A0';
  lastCopyMessage = message;
  if (tip) tip.textContent = '';
  void button.offsetWidth;
  button.setAttribute(ok ? 'data-copied' : 'data-failed', '');
  if (tip) {
    requestAnimationFrame(() => {
      tip.textContent = message;
    });
  }
  copyTimers.set(
    button,
    setTimeout(() => {
      button.removeAttribute('data-copied');
      button.removeAttribute('data-failed');
      if (tip) tip.textContent = '';
    }, 1800)
  );
}

async function copyElementText(button, target) {
  const text = target.matches('input, textarea') ? target.value.trim() : target.innerText.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    reportCopyResult(button, true);
    showToast('已复制 China Bank 银行账号');
  } catch {
    const ok = legacyCopyText(text);
    reportCopyResult(button, ok);
    if (ok) showToast('已复制 China Bank 银行账号');
  }
}

function initCopyCommands() {
  document.addEventListener(
    'command',
    (event) => {
      if (event.command && event.command.startsWith('--copy')) {
        copyElementText(event.source, event.target);
      }
    },
    true
  );

  if (!('CommandEvent' in window)) {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[command^="--copy"]');
      if (!button) return;
      const target = document.getElementById(button.getAttribute('commandfor'));
      if (target) copyElementText(button, target);
    });
  }
}

/* ==================== 初始化 ==================== */
document.addEventListener('DOMContentLoaded', () => {
  initCopyCommands();
  document.getElementById('btn-refresh').addEventListener('click', loadPartnerOrders);
  ['search-input', 'filter-shipping', 'filter-payment'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', renderPartnerTable);
      el.addEventListener('change', renderPartnerTable);
    }
  });
  loadPartnerOrders();
});

function getGasUrl() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    return (cfg.gasUrl || DEFAULT_GAS_URL || '').trim();
  } catch {
    return DEFAULT_GAS_URL;
  }
}

function isLiveMode() {
  return getGasUrl().startsWith('https://');
}

function matchesPartner(shippingVal) {
  const s = String(shippingVal || '').toUpperCase();
  if (PARTNER_CODE === 'LBS') return s.includes('LBS');
  return s.includes('TNL');
}

function findVendorLatestBank(vendorName) {
  const v = String(vendorName || '').trim().toLowerCase();
  if (!v) return '';
  let best = null;
  for (const o of state.orders) {
    if (String(o.vendor || '').trim().toLowerCase() === v && o.chinaBank && String(o.chinaBank).trim()) {
      if (!best || Number(o.rowIndex) > Number(best.rowIndex)) {
        best = o;
      }
    }
  }
  return best ? String(best.chinaBank).trim() : '';
}

async function loadPartnerOrders() {
  const tbody = document.getElementById('orders-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="empty-cell">正在同步最新订单数据...</td></tr>';

  try {
    let allOrders = [];
    if (isLiveMode()) {
      const res = await fetch(getGasUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'listOrders', partner: PARTNER_CODE })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '读取失败');
      allOrders = data.orders || [];
    } else {
      allOrders = structuredClone(DEMO_ORDERS);
    }

    // 仅保留属于当前物流商 (TNL 或 LBS) 的订单
    state.orders = allOrders.filter((o) => matchesPartner(o.shipping));
    state.shippings = [...new Set(state.orders.map((o) => o.shipping).filter(Boolean))].sort();

    populateShippingFilter();
    renderPartnerTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-cell">读取失败：${escapeHtml(err.message)}</td></tr>`;
    showToast('读取失败: ' + err.message);
  }
}

function populateShippingFilter() {
  const shipSelect = document.getElementById('filter-shipping');
  if (!shipSelect) return;
  const current = shipSelect.value;
  shipSelect.innerHTML = `<option value="">全部 ${PARTNER_CODE} 地区/渠道</option>`;
  state.shippings.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    shipSelect.appendChild(opt);
  });
  shipSelect.value = current;
}

function getFilteredOrders() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const ship = document.getElementById('filter-shipping').value;
  const pay = document.getElementById('filter-payment').value;

  return state.orders.filter((o) => {
    if (ship && o.shipping !== ship) return false;
    if (pay && (o.statusPayment || 'PENDING').toUpperCase() !== pay) return false;
    if (q) {
      const bank = findVendorLatestBank(o.vendor) || o.chinaBank || '';
      const hay = `${o.poNo} ${o.vendor} ${o.itemSummary} ${o.shipping} ${bank}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderPartnerKpis(rows) {
  const total = rows.length;
  let totalCartons = 0;
  let doneCount = 0;
  let pendingCount = 0;

  rows.forEach((o) => {
    const c = Number(o.cartons);
    if (!isNaN(c) && c > 0) totalCartons += c;
    if (String(o.statusPayment || 'PENDING').toUpperCase() === 'DONE') {
      doneCount++;
    } else {
      pendingCount++;
    }
  });

  document.getElementById('kpi-total').textContent = String(total);
  document.getElementById('kpi-cartons').textContent = String(totalCartons);
  document.getElementById('kpi-done').textContent = String(doneCount);
  document.getElementById('kpi-pending').textContent = String(pendingCount);
}

/**
 * 严格按照 \patner\TNL (1).xlsx 的 11 列只读格式渲染：
 * 1. DATE
 * 2. ITEM SUMMERY
 * 3. VENDOR
 * 4. SHIPPING
 * 5. 入库单GOOGLE DRIVE
 * 6. PO NOMBOR
 * 7. quantity carton
 * 8. po GOOGLE DRIVE
 * 9. PO AMOUNT人民币
 * 10. STATUS PAYMENT
 * 11. CHINA BANK (仅可查看与一键复制，无任何修改功能)
 */
function renderPartnerTable() {
  const tbody = document.getElementById('orders-tbody');
  const rows = getFilteredOrders();
  renderPartnerKpis(rows);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-cell">暂无匹配的订单记录</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  rows.forEach((order) => {
    const tr = document.createElement('tr');
    const payStatus = String(order.statusPayment || 'PENDING').toUpperCase();
    tr.className = payStatus === 'DONE' ? 'row-complete' : 'row-pending';

    // 1. DATE
    tr.appendChild(makeCell('DATE', formatShortDate(order.date) || '-', 'col-date'));

    // 2. ITEM SUMMERY
    tr.appendChild(makeCell('ITEM SUMMERY', order.itemSummary || '-', 'col-summary'));

    // 3. VENDOR
    tr.appendChild(makeCell('VENDOR', order.vendor || '-', 'col-vendor'));

    // 4. SHIPPING
    const shipTd = document.createElement('td');
    shipTd.setAttribute('data-label', 'SHIPPING');
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

    // 5. 入库单GOOGLE DRIVE
    const whTd = document.createElement('td');
    whTd.setAttribute('data-label', '入库单 GOOGLE DRIVE');
    whTd.className = 'col-links';
    const whStack = document.createElement('div');
    whStack.className = 'links-stack';
    appendLinkChips(whStack, order.warehouseReceiptLinks, '入库单');
    if (!whStack.children.length) {
      const emptyWh = document.createElement('span');
      emptyWh.className = 'hint';
      emptyWh.textContent = '-';
      whStack.appendChild(emptyWh);
    }
    whTd.appendChild(whStack);
    tr.appendChild(whTd);

    // 6. PO NOMBOR
    const poTh = document.createElement('th');
    poTh.scope = 'row';
    poTh.className = 'col-po';
    poTh.textContent = order.poNo || '-';
    tr.appendChild(poTh);

    // 7. quantity carton
    tr.appendChild(
      makeCell('quantity carton', order.cartons !== '' && order.cartons !== undefined ? String(order.cartons) : '-', 'col-cartons')
    );

    // 8. po GOOGLE DRIVE
    const poLinkTd = document.createElement('td');
    poLinkTd.setAttribute('data-label', 'po GOOGLE DRIVE');
    poLinkTd.className = 'col-links';
    const poStack = document.createElement('div');
    poStack.className = 'links-stack';
    appendLinkChips(poStack, order.poLink, 'PO表', 'po');
    if (!poStack.children.length) {
      const emptyPo = document.createElement('span');
      emptyPo.className = 'hint';
      emptyPo.textContent = '-';
      poStack.appendChild(emptyPo);
    }
    poLinkTd.appendChild(poStack);
    tr.appendChild(poLinkTd);

    // 9. PO AMOUNT人民币
    tr.appendChild(
      makeCell('PO AMOUNT人民币', order.poAmount !== '' && order.poAmount !== undefined ? formatRmb(order.poAmount) : '-', 'col-amount')
    );

    // 10. STATUS PAYMENT
    const statusTd = document.createElement('td');
    statusTd.setAttribute('data-label', 'STATUS PAYMENT');
    statusTd.className = 'col-status';
    const payClass = payStatus === 'DONE' ? 'badge-done' : 'badge-pending';
    statusTd.innerHTML = `<span class="badge ${payClass}">${escapeHtml(payStatus)}</span>`;
    tr.appendChild(statusTd);

    // 11. CHINA BANK (只读展示 + 一键 Copy，无修改按钮)
    const bankTd = document.createElement('td');
    bankTd.setAttribute('data-label', 'CHINA BANK');
    bankTd.className = 'col-bank';
    const bankVal = findVendorLatestBank(order.vendor) || String(order.chinaBank || '').trim();
    const bankId = `p-bank-${order.rowIndex}`;
    const bankWrap = document.createElement('div');
    bankWrap.className = 'bank-cell-wrap';

    if (bankVal) {
      const bankTextDiv = document.createElement('div');
      bankTextDiv.id = bankId;
      bankTextDiv.className = 'bank-text';
      bankTextDiv.textContent = bankVal;
      bankWrap.appendChild(bankTextDiv);

      const actBar = document.createElement('div');
      actBar.className = 'bank-actions';
      const copySpan = document.createElement('span');
      copySpan.className = 'copy';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'copy-button';
      copyBtn.setAttribute('command', '--copy');
      copyBtn.setAttribute('commandfor', bankId);
      copyBtn.textContent = '📋 复制';
      const tipSpan = document.createElement('span');
      tipSpan.className = 'tip';
      tipSpan.setAttribute('role', 'status');
      copySpan.appendChild(copyBtn);
      copySpan.appendChild(tipSpan);
      actBar.appendChild(copySpan);
      bankWrap.appendChild(actBar);
    } else {
      const emptyBank = document.createElement('span');
      emptyBank.className = 'hint';
      emptyBank.textContent = '-';
      bankWrap.appendChild(emptyBank);
    }
    bankTd.appendChild(bankWrap);
    tr.appendChild(bankTd);

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

function formatShortDate(raw) {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str) return '';
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}(\s*,\s*\d{1,2}\/\d{1,2}\/\d{2,4})*$/.test(str)) {
    return str;
  }
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
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
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}
