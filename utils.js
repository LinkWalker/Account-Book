/**
 * 记账本公共工具。负责人：薛强龙。
 * 普通 script 引入后通过 LedgerUtils 调用；不占用其他模块的全局函数名。
 */
(function (root) {
  'use strict';

  /** 日期转为本地 YYYY-MM-DD；日期字符串保持本地日期，避免 UTC 时差。 */
  function formatDate(value) {
    if (value === undefined) value = new Date();
    var date;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var parts = value.split('-').map(Number);
      date = new Date(0);
      date.setFullYear(parts[0], parts[1] - 1, parts[2]);
      date.setHours(0, 0, 0, 0);
      if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 ||
          date.getDate() !== parts[2]) throw new RangeError('日期不存在');
    } else {
      if (!(value instanceof Date) && typeof value !== 'number') {
        throw new TypeError('日期必须为 Date、时间戳或 YYYY-MM-DD 字符串');
      }
      date = new Date(value instanceof Date ? value.getTime() : value);
    }
    if (!Number.isFinite(date.getTime())) throw new RangeError('无效日期');
    return String(date.getFullYear()).padStart(4, '0') + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  /** 金额文本转整数分；不接受负数、指数写法或超过两位小数。 */
  function moneyToCents(value) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new TypeError('金额必须为数字或字符串');
    }
    var text = String(value).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new RangeError('金额须为非负数，最多两位小数');
    var parts = text.split('.');
    var cents = Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'));
    if (!Number.isSafeInteger(cents)) throw new RangeError('金额超出安全范围');
    return cents;
  }

  /** 整数分转固定两位小数，可用于收入、支出及负结余展示。 */
  function centsToMoney(cents) {
    if (!Number.isSafeInteger(cents)) throw new TypeError('分金额必须为安全整数');
    var absolute = Math.abs(cents);
    return (cents < 0 ? '-' : '') + Math.floor(absolute / 100) + '.' +
      String(absolute % 100).padStart(2, '0');
  }

  /** 尾沿防抖，保留 this 和参数；cancel 取消，flush 立即执行等待中的调用。 */
  function debounce(fn, wait) {
    if (typeof fn !== 'function') throw new TypeError('fn 必须为函数');
    if (wait === undefined) wait = 300;
    if (!Number.isFinite(wait) || wait < 0) throw new RangeError('等待时间须为非负毫秒数');
    var timer = null;
    var context;
    var args;
    function invoke() {
      var savedContext = context;
      var savedArgs = args;
      timer = null;
      context = args = undefined;
      return fn.apply(savedContext, savedArgs);
    }
    function debounced() {
      if (timer !== null) clearTimeout(timer);
      context = this;
      args = arguments;
      timer = setTimeout(invoke, wait);
    }
    debounced.cancel = function () {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      context = args = undefined;
    };
    debounced.flush = function () {
      if (timer === null) return undefined;
      clearTimeout(timer);
      return invoke();
    };
    return debounced;
  }

  /** 仅用于 HTML 文本内容转义；创建节点时优先使用 textContent。 */
  function escapeHtml(value) {
    var entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return entities[char];
    });
  }

  var api = Object.freeze({ formatDate: formatDate, moneyToCents: moneyToCents,
    centsToMoney: centsToMoney, debounce: debounce, escapeHtml: escapeHtml });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LedgerUtils = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
