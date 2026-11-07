// Run with: node --test tests/integration.test.cjs
// Uses a small DOM/storage/ECharts stub; does not replace browser visual QA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function app(options = {}) {
  const nodes = {}, listeners = {}, pending = [], charts = [], downloads = [], alerts = [];
  const store = options.store || new Map();
  let failWrite = false, resetCount = 0;
  class Element {
    constructor(id) {
      this.id = id; this.value = ''; this.checked = false; this.textContent = '';
      this.className = ''; this.dataset = {}; this.options = []; this.events = {};
      this.children = []; this.style = {};
      this.classList = { add() {}, remove() {} };
    }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    emit(type, target = this) {
      for (const fn of this.events[type] || []) fn({ target, preventDefault() {} });
    }
    setAttribute(key, value) { this[key] = value; }
    getAttribute(key) { return this[key]; }
    appendChild(node) { this.children.push(node); }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html || ''; }
    focus() {}
    click() { downloads.push(this.download); }
    insertAdjacentHTML() {
      nodes.chartTabs = new Element('chartTabs');
      tabs.push(...['expense', 'income'].map(value => {
        const tab = new Element(); tab.dataset.tab = value; return tab;
      }));
    }
  }
  for (const id of ['ledgerForm', 'recordDate', 'recordAmount', 'recordCategory',
    'recordNote', 'formTip', 'ledger-tbody', 'stat-income', 'stat-expense',
    'stat-balance', 'filterDate', 'filterMinAmount', 'filterMaxAmount', 'filterCategory', 'chartPie', 'chart', 'chart-title', 'export-btn', 'exportCsvBtn']) {
    nodes[id] = new Element(id);
  }
  const tabs = [], radios = ['expense', 'income'].map(type => {
    const radio = new Element(); radio.value = type; radio.checked = type === 'expense'; return radio;
  });
  nodes.recordCategory.options = ['', '饮食', '交通', '工资'].map(value => ({
    value, get selected() { return nodes.recordCategory.value === value; }
  }));
  nodes.ledgerForm.reset = () => {
    resetCount++; nodes.ledgerForm.emit('reset');
    for (const id of ['recordDate', 'recordAmount', 'recordCategory', 'recordNote']) nodes[id].value = '';
  };
  const document = {
    readyState: 'loading', body: new Element(),
    getElementById: id => nodes[id] || null,
    querySelector: selector => selector === '#ledger-tbody' ? nodes['ledger-tbody'] :
      selector.includes(':checked') ? radios.find(radio => radio.checked) : null,
    querySelectorAll: selector => selector === 'input[name="recordType"]' ? radios :
      selector === '.chart-tab' ? tabs : [],
    createElement: () => new Element(),
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(event) { for (const fn of listeners[event.type] || []) fn(event); }
  };
  const context = {
    document, Blob, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    console: { log() {}, warn() {}, error() {} },
    setTimeout: fn => pending.push(fn), clearTimeout() {},
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem(key, value) { if (failWrite) throw Error('QuotaExceededError'); store.set(key, value); }
    },
    confirm: () => true, alert: message => alerts.push(message), addEventListener() {}
  };
  if (!options.offline) context.echarts = { init: () => ({ setOption: option => charts.push(option), resize() {} }) };
  context.window = context;
  vm.createContext(context);
  for (const file of ['utils.js', 'storage.js', 'form.js', 'list.js', 'stats.js', 'chart.js', 'export.js', 'filter.js']) {
    vm.runInContext(read(file), context, { filename: file });
  }
  for (const match of read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1], context);
  document.readyState = 'complete'; document.dispatchEvent({ type: 'DOMContentLoaded' });
  function submit(amount = '18.00', category = '饮食', type = 'expense', note = '') {
    for (const radio of radios) radio.checked = radio.value === type;
    nodes.recordDate.value = '2026-11-07'; nodes.recordAmount.value = amount;
    nodes.recordCategory.value = category; nodes.recordNote.value = note;
    nodes.ledgerForm.emit('submit');
  }
  function remove(id) {
    nodes['ledger-tbody'].emit('click', { closest: () => ({ getAttribute: () => id }) });
  }
  return { context, nodes, store, charts, tabs, downloads, alerts, submit, remove,
    set failWrite(value) { failWrite = value; }, get resetCount() { return resetCount; },
    rows: () => nodes['ledger-tbody'].children.map(row => row.innerHTML).join(''),
    flush() { while (pending.length) pending.shift()(); } };
}

test('18 yuan stays 1800 cents in storage, displays 18 and exports 18', () => {
  const a = app(); a.submit();
  assert.equal(a.context.getData()[0].amount, 1800);
  assert.equal(a.nodes['stat-expense'].textContent, '¥18.00');
  assert.match(a.rows(), /-¥18\.00/);
  assert.equal(JSON.parse(a.context.LedgerExport.toJSON(a.context.getData()))[0].amount, 18);
  assert.match(a.context.LedgerExport.toCSV(a.context.getData()), /,18,/);
});

test('integer-cent totals, income/expense charts, switching and persistence', () => {
  const a = app(); a.submit('0.10'); a.submit('0.20'); a.submit('10.00', '工资', 'income');
  assert.equal(a.nodes['stat-expense'].textContent, '¥0.30');
  assert.equal(a.nodes['stat-income'].textContent, '¥10.00');
  assert.equal(a.nodes['stat-balance'].textContent, '¥9.70');
  assert.equal(a.charts.at(-1).series[0].data[0].value, 0.3);
  a.tabs[1].emit('click');
  assert.equal(a.charts.at(-1).series[0].data[0].value, 10);
  const reload = app({ store: a.store });
  assert.equal(reload.nodes['stat-expense'].textContent, '¥0.30');
});

test('six table headers align with six escaped cells', () => {
  const a = app(); a.submit('18.00', '饮食', 'expense', '<img src=x onerror=alert(1)>');
  assert.equal((read('index.html').match(/<th scope="col"/g) || []).length, 6);
  assert.equal((a.rows().match(/<td /g) || []).length, 6);
  assert.doesNotMatch(a.rows(), /<img/);
  assert.match(a.rows(), /&lt;img/);
  assert.match(a.rows(), /col-type">支出/);
});

test('filter remains active after add and delete; totals follow filters', () => {
  const a = app(); a.submit('18.00'); a.submit('2.00', '交通');
  const transport = a.context.getData()[1].id;
  a.nodes.filterCategory.value = '交通'; a.nodes.filterCategory.emit('change');
  a.submit('20.00'); assert.doesNotMatch(a.rows(), /饮食/); assert.match(a.rows(), /交通/);
  a.remove(transport); assert.match(a.rows(), /colspan="6"/);
  assert.equal(a.context.getData().length, 2);
  assert.equal(a.nodes['stat-expense'].textContent, '¥0.00');
  assert.equal(a.charts.at(-1).title.text, '暂无数据');
});

test('failed save retains input, does not reset or change chart/list/stats', () => {
  const a = app(); a.failWrite = true; const before = a.charts.length;
  a.submit(); assert.equal(a.context.getData().length, 0);
  assert.equal(a.resetCount, 0); assert.equal(a.nodes.recordAmount.value, '18.00');
  assert.match(a.nodes.formTip.textContent, /保存失败/);
  assert.equal(a.nodes['stat-expense'].textContent, '¥0.00');
  assert.equal(a.charts.length, before);
});

test('failed delete preserves record and displayed data', () => {
  const a = app(); a.submit(); const before = a.rows(); a.failWrite = true;
  a.remove(a.context.getData()[0].id);
  assert.equal(a.context.getData().length, 1); assert.equal(a.rows(), before);
  assert.match(a.alerts[0], /删除失败/);
});

test('corrupt storage is not overwritten by a new record', () => {
  const a = app({ store: new Map([['accountBookData', '{invalid']]) });
  a.submit(); assert.equal(a.store.get('accountBookData'), '{invalid');
  assert.match(a.nodes.formTip.textContent, /读取账本失败/); assert.equal(a.resetCount, 0);
});

test('deleting final record clears chart and totals', () => {
  const a = app(); a.submit(); a.remove(a.context.getData()[0].id);
  assert.equal(a.nodes['stat-expense'].textContent, '¥0.00');
  assert.equal(a.charts.at(-1).title.text, '暂无数据');
});

test('JSON and CSV buttons download the advertised formats', () => {
  const a = app(); a.submit();
  a.nodes['export-btn'].emit('click'); a.nodes.exportCsvBtn.emit('click');
  assert.deepEqual(a.downloads, ['data.json', 'data.csv']);
  assert.match(a.context.LedgerExport.toCSV(a.context.getData()), /,18,/);
});

test('missing chart CDN leaves recording usable; invalid input is rejected', () => {
  const a = app({ offline: true });
  assert.match(a.nodes.chartPie.textContent, /加载失败/);
  a.submit('0'); assert.equal(a.context.getData().length, 0);
  a.submit('18.00', '工资', 'expense'); assert.equal(a.context.getData().length, 0);
  a.submit(); assert.equal(a.context.getData().length, 1);
});


test('date and amount filters update list, totals and chart together', () => {
  const a = app(); a.submit('18.00'); a.submit('2.00', '交通');
  a.nodes.filterMinAmount.value = '10'; a.nodes.filterMinAmount.emit('input');
  assert.equal(a.nodes['stat-expense'].textContent, '¥18.00');
  assert.doesNotMatch(a.rows(), /交通/);
  assert.equal(a.charts.at(-1).series[0].data[0].value, 18);
  a.nodes.filterMaxAmount.value = '15'; a.nodes.filterMaxAmount.emit('input');
  assert.equal(a.nodes['stat-expense'].textContent, '¥0.00');
  a.nodes.filterMinAmount.value = ''; a.nodes.filterMaxAmount.value = '';
  a.nodes.filterDate.value = '2026-11-06'; a.nodes.filterDate.emit('input');
  assert.match(a.rows(), /colspan="6"/);
  a.nodes.filterDate.value = ''; a.nodes.filterDate.emit('input');
  assert.equal(a.nodes['stat-expense'].textContent, '¥20.00');
});

test('corrupt storage blocks both exports with the read error', () => {
  const a = app({ store: new Map([['accountBookData', '{invalid']]) });
  assert.equal(a.context.LedgerExport.exportJSON(), false);
  assert.ok(a.context.LedgerExport.readRecords.lastError);
  assert.equal(a.context.LedgerExport.exportCSV(), false);
  assert.equal(a.downloads.length, 0);
});
