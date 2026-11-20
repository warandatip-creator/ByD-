/* Body Scent - shared script for all pages
   product.html : #filter-bar, #product-list
   order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   admin.html   : #ordersTable tbody
*/

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxiW-QrrRnCCmbpsWmXcv2lrTmb2Vmb0RPC7QNzhblLQ2QC6nuBTJY0kykUKEn4kZ5NpA/exec';
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQoXnHc4mHEu9BHz5xyP4JOvctB_F6r1uX-IQR1jbmcV4BPxdlq4XNKK4AQwgbhvGqyBO7GTiCaDKZZ/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

/* ---------- helpers ---------- */

// set value for <input>/<textarea>, or text for other elements
function setFieldValue(el, value) {
  if (!el) return;
  if ('value' in el) {
    el.value = value;
  } else {
    el.textContent = value;
  }
}

function getFieldValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  return ('value' in el ? el.value : el.textContent).trim();
}

/* ---------- 1) product.html ---------- */

function initProductPage() {
  const filterBar = document.getElementById('filter-bar');
  const list = document.getElementById('product-list');
  if (!filterBar || !list) return;

  let products = [];
  let currentMood = 'all';

  function renderFilters() {
    filterBar.innerHTML = '';
    MOODS.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = m.label;
      btn.dataset.mood = m.key;
      if (m.key === currentMood) btn.classList.add('active');
      btn.addEventListener('click', () => {
        currentMood = m.key;
        renderFilters();
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  function renderProducts() {
    list.innerHTML = '';
    const shown = currentMood === 'all'
      ? products
      : products.filter(p => p.mood === currentMood);

    if (shown.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'ยังไม่มีสินค้าในหมวดนี้';
      list.appendChild(empty);
      return;
    }

    shown.forEach(p => {
      const fullName = p.size ? p.name + ' ' + p.size : p.name;

      const card = document.createElement('div');
      card.className = 'product-card';
      card.dataset.mood = p.mood;

      const img = document.createElement('img');
      img.src = p.image;
      img.alt = fullName;
      img.loading = 'lazy';

      const body = document.createElement('div');
      body.className = 'card-body';

      const h3 = document.createElement('h3');
      h3.textContent = p.name;

      const size = document.createElement('p');
      size.className = 'size';
      size.textContent = p.size || (p.type === 'rollon' ? 'โรลออน' : '');

      const price = document.createElement('p');
      price.className = 'price';
      price.textContent = Number(p.price).toLocaleString('th-TH') + ' บาท';

      const btn = document.createElement('a');
      btn.className = 'btn btn--accent btn--block';
      btn.textContent = 'สั่งซื้อ';
      btn.href = 'order.html?item=' + encodeURIComponent(fullName) +
                 '&price=' + encodeURIComponent(p.price);

      body.append(h3, size, price, btn);
      card.append(img, body);
      list.appendChild(card);
    });
  }

  // auto-filter from ?mood=xxx
  const moodParam = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
  if (MOODS.some(m => m.key === moodParam)) currentMood = moodParam;

  renderFilters();

  fetch('products.json')
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      products = data;
      renderProducts();
    })
    .catch(error => {
      console.error(error);
      list.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'empty-state';
      msg.textContent = 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองรีเฟรชหน้านี้';
      list.appendChild(msg);
    });
}

/* ---------- 2) order.html ---------- */

function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  // fill #items and #total from URL params
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item') || '';
  const price = params.get('price') || '';
  setFieldValue(document.getElementById('items'), item);
  setFieldValue(document.getElementById('total'), price);

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const payload = {
      customerName: getFieldValue('customerName'),
      contact: getFieldValue('contact'),
      items: getFieldValue('items'),
      total: getFieldValue('total'),
      note: getFieldValue('note')
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ---------- 3) admin.html ---------- */

// CSV parser (handles quoted fields, escaped quotes "", commas and newlines in quotes)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  // last field/row
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  function showMessage(text) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = text;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(CSV_URL, { cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(text => {
      const rows = parseCSV(text);
      rows.shift(); // remove header row
      rows.reverse(); // newest first (sheet is appended oldest -> newest)

      if (rows.length === 0) {
        showMessage('ยังไม่มีออเดอร์');
        return;
      }

      tbody.innerHTML = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        // date, customer name, contact, items, total, note
        for (let i = 0; i < 6; i++) {
          const td = document.createElement('td');
          td.textContent = r[i] || ''; // textContent: customer input is never run as HTML
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error(error);
      showMessage('โหลดข้อมูลไม่สำเร็จ กรุณาลองรีเฟรชหน้านี้');
    });
}

/* ---------- init (each function does nothing if its page's elements are absent) ---------- */

document.addEventListener('DOMContentLoaded', function () {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
