/**
 * list.js —— 马天鸿
 * 职责：
 *   1. 读取账本数据，动态渲染 HTML 表格（日期 / 金额 / 类别 / 备注 / 操作）
 *   2. 实现"删除"按钮：点击后从 localStorage 移除该记录，并重新渲染
 *
 * 数据约定（与 storage.js 梁洪睿、form.js 翁齐文对齐）：
 *   { id, date, amount, type:'income'|'expense', category, note }
 *
 * 对外暴露：window.renderList(records?)
 *   - 传数组则渲染该数组（filter.js 魏怡健筛选后调用）
 *   - 不传则从 storage 全量读取
 *
 * 监听事件：records:changed，自动重新渲染
 */
(function (global) {
  'use strict';

  const TBODY_SELECTOR = '#ledger-tbody';

  /* ---------------- 渲染辅助 ---------------- */

  function formatAmount(record) {
    const sign = record.type === 'expense' ? '-' : '+';
    const num = global.LedgerUtils.centsToMoney(Math.abs(Number(record.amount) || 0));
    return sign + '¥' + num;
  }

  function amountClass(record) {
    return record.type === 'expense' ? 'expense' : 'income';
  }

  function renderEmptyRow(tbody) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="6" class="empty-state">暂无符合条件的记录</td>';
    tbody.appendChild(tr);
  }

  function renderRow(record) {
    const tr = document.createElement('tr');
    tr.dataset.id = record.id;
    const esc = global.LedgerUtils.escapeHtml;
    tr.innerHTML =
      '<td class="col-date">' + esc(record.date || '-') + '</td>' +
      '<td class="col-type">' + (record.type === 'income' ? '收入' : '支出') + '</td>' +
      '<td class="col-category"><span class="tag">' + esc(record.category || '未分类') + '</span></td>' +
      '<td class="col-amount amount ' + amountClass(record) + '">' + formatAmount(record) + '</td>' +
      '<td class="col-note">' + esc(record.note || '') + '</td>' +
      '<td class="col-action"><button type="button" class="btn-delete btn btn-danger btn-sm" data-id="' + esc(record.id) + '">删除</button></td>';
    return tr;
  }

  /* ---------------- 核心渲染 ---------------- */

  function renderList(records) {
    const tbody = document.querySelector(TBODY_SELECTOR);
    if (!tbody) {
      console.warn('[list.js] 找不到表格容器 ' + TBODY_SELECTOR);
      return;
    }

    if (!Array.isArray(records)) {
      records = (typeof global.getData === 'function') ? global.getData() : [];
    }

    // 每次刷新都保留当前筛选条件，包括新增和删除引起的刷新。
    const category = document.getElementById('filterCategory');
    if (category && global.LedgerFilter) {
      records = global.LedgerFilter.filterByCategory(records, category.value);
    }

    tbody.innerHTML = '';
    if (!records || records.length === 0) {
      renderEmptyRow(tbody);
      return;
    }

    // 日期倒序：新记录在前
    const sorted = records.slice().sort(function (a, b) {
      if (a.date === b.date) return String(b.id || '').localeCompare(String(a.id || ''));
      return a.date < b.date ? 1 : -1;
    });

    sorted.forEach(function (r) { tbody.appendChild(renderRow(r)); });
  }

  /* ---------------- 删除 ---------------- */

  function deleteRecord(id) {
    if (!id) return;
    if (!global.confirm('确定要删除这条记录吗？')) return;

    const all = (typeof global.getData === 'function') ? global.getData() : [];
    if (global.getData && global.getData.lastError) {
      global.alert('读取账本失败，未删除记录：' + global.getData.lastError);
      return;
    }
    const next = all.filter(function (r) { return r.id !== id; });

    if (typeof global.saveData === 'function') {
      if (global.saveData(next) !== true) {
        global.alert('删除失败：' + (global.saveData.lastError || '本地存储写入失败'));
        return;
      }
      document.dispatchEvent(new CustomEvent('records:changed', { detail: { records: next } }));
    }
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents() {
    const tbody = document.querySelector(TBODY_SELECTOR);
    if (!tbody) return;
    tbody.addEventListener('click', function (e) {
      const btn = e.target.closest ? e.target.closest('.btn-delete') : null;
      if (!btn) return;
      deleteRecord(btn.getAttribute('data-id'));
    });
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    bindEvents();
    renderList();
    document.addEventListener('records:changed', function (e) {
      renderList(e.detail && e.detail.records);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.renderList = renderList;
  global.refreshList = renderList;
})(window);
