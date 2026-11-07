/*!
 * export.js —— 个人记账本 · 数据导出模块
 * 负责人：陈嘉俊
 * 版本：1.0.0（2026-11-07）
 *
 * 职责：点击「导出」按钮，把当前全部账本记录导出为 data.json 下载到本地。
 * 依赖：storage.js 暴露的 getData()，返回记录数组。
 *       若 getData 尚不存在（队友还没写完），会自动回退到直接读 localStorage，
 *       所以本模块可以完全独立开发和自测。
 *
 * 对外接口（挂在 window.LedgerExport 上）：
 *   LedgerExport.exportJSON()   导出 data.json
 *   LedgerExport.exportCSV()    附带能力：导出 data.csv（可供 Excel 打开）
 *   LedgerExport.readRecords()  读取当前记录（做容错）
 *   LedgerExport.toJSON(list)   纯函数：记录数组 -> JSON 字符串
 *   LedgerExport.toCSV(list)    纯函数：记录数组 -> CSV 字符串
 *   LedgerExport.init()         手动初始化（正常情况自动执行）
 *   LedgerExport.config         可改默认文件名、金额单位等
 *
 * 与仓库现有文件的字段约定（已对齐 form.html，2026-11-07 核对）：
 *   type      'expense' | 'income'          （form.html 的 recordType radio 值）
 *   date      'YYYY-MM-DD'                  （form.html 的 date input）
 *   category  中文类别名：饮食/交通/购物/娱乐/学习/医疗/居住/其他支出
 *                            工资/兼职/理财/红包/其他收入
 *   amount    数字，单位为「元」，两位小数（form.html：step=0.01、min=0.01）
 *   note      字符串，≤30 字
 *
 * 注意：utils.js 提供了 moneyToCents()/centsToMoney()，若梁洪睿的 storage.js
 *      最终决定「金额以整数分存储」，请把下面 CONFIG.amountUnit 改成 'cents'，
 *      本模块导出时会统一换算成「元」，否则 data.json 里会出现 2550 而不是 25.5。
 *
 * 页面接入（交给李韩远，已按 style.css 的约定对齐）：
 *   <div class="toolbar">
 *     <button id="exportBtn" type="button" class="btn btn-ghost">导出数据</button>
 *     <button id="exportCsvBtn" type="button" class="btn btn-ghost">导出 CSV</button>
 *   </div>
 *   <script src="export.js"></script>
 *   · style-接入说明.md 第 63/65 行已把「导出」列入 .btn-ghost + .toolbar 的对接模块
 *   · type="button" 必须写：否则按钮在 <form> 里会被当成提交按钮（本模块另行 preventDefault 兜底）
 *   · 按钮文字用「导出数据」，不要用「备份」，和答辩时的说法保持一致
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 可调配置
   * ------------------------------------------------------------------ */
  var CONFIG = {
    fileName: 'data.json',   // 题目要求：data.json（不要改名）
    indent: 2,               // JSON 缩进，方便人眼查看
    withMeta: false,         // true 时导出 {version, exportedAt, count, records}
    metaVersion: '1.0',
    csvFileName: 'data.csv',
    // 'yuan'  = storage 里存的就是元（form.html 的默认语义）
    // 'cents' = storage 里存的是整数分（utils.js 的 moneyToCents 结果），导出时换算成元
    amountUnit: 'yuan'
  };

  // 队友可能使用的 localStorage key，按顺序探测（回退用）
  var KEY_CANDIDATES = [
    'ledgerRecords',
    'records',
    'ledger_data',
    'ledgerData',
    'accountBook',
    'accountBookRecords',
    'accounting_records',
    'bookkeeping_records'
  ];

  /* ------------------------------------------------------------------ *
   * 一、读取数据（对 storage.js 零硬依赖）
   * ------------------------------------------------------------------ */
  function isArrayLikeList(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function pickList(value) {
    if (isArrayLikeList(value)) return value;
    // 兼容 storage.js 把数组包一层的写法（记录字段名尚未最终确认，多认几种）
    if (value) {
      if (isArrayLikeList(value.records)) return value.records;
      if (isArrayLikeList(value.list)) return value.list;
      if (isArrayLikeList(value.data)) return value.data;
    }
    return null;
  }

  function readRecords() {
    // 1) 优先用队友的 storage.js
    if (typeof getData === 'function') {
      try {
        var fromStorage = pickList(getData());
        if (fromStorage) return fromStorage;
      } catch (err) {
        // getData 抛错（例如 JSON 损坏）时不中断导出，继续走回退
        if (typeof console !== 'undefined') {
          console.warn('[export.js] getData() 调用失败，改用 localStorage 回退：', err);
        }
      }
    }

    // 2) 回退：直接读 localStorage
    if (typeof localStorage !== 'undefined' && localStorage) {
      for (var i = 0; i < KEY_CANDIDATES.length; i++) {
        var raw = null;
        try {
          raw = localStorage.getItem(KEY_CANDIDATES[i]);
        } catch (err) {
          continue;
        }
        if (!raw) continue;
        try {
          var parsed = pickList(JSON.parse(raw));
          if (parsed) return parsed;
        } catch (err2) {
          // 该 key 内容不是合法 JSON，换下一个
        }
      }
    }

    // 3) 什么都没读到
    return [];
  }

  // 只保留合法对象，避免 undefined / 字符串混进导出结果
  function normalize(records) {
    var list = pickList(records) || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item && typeof item === 'object') out.push(item);
    }
    return out;
  }

  /**
   * 按导出配置整理记录：目前只处理金额单位。
   * storage 存「分」时统一换成「元」，避免 data.json / data.csv 里出现 2550 而不是 25.5。
   * 返回新数组，不修改调用方传入的对象。
   */
  function presentRecords(list, options) {
    var o = mergeOptions(options);
    if (o.amountUnit !== 'cents') return list;

    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var copy = {};
      var key;
      for (key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) copy[key] = item[key];
      }
      var cents = Number(copy.amount);
      if (isFinite(cents)) {
        copy.amount = Math.round(cents) / 100; // 2550 分 -> 25.5 元
      }
      out.push(copy);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 二、序列化（纯函数，方便单测）
   * ------------------------------------------------------------------ */
  function mergeOptions(opts) {
    var merged = {};
    var key;
    for (key in CONFIG) {
      if (Object.prototype.hasOwnProperty.call(CONFIG, key)) merged[key] = CONFIG[key];
    }
    if (opts && typeof opts === 'object') {
      for (key in opts) {
        if (Object.prototype.hasOwnProperty.call(opts, key)) merged[key] = opts[key];
      }
    }
    return merged;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function nowISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  /**
   * @param {Array} records 记录数组
   * @param {Object} [opts] {indent, withMeta, metaVersion}
   * @returns {string} JSON 文本（UTF-8）
   */
  function toJSON(records, opts) {
    var o = mergeOptions(opts);
    var list = presentRecords(normalize(records), o);
    var payload;

    if (o.withMeta) {
      payload = {
        version: o.metaVersion,
        exportedAt: nowISO(),
        count: list.length,
        records: list
      };
    } else {
      payload = list; // 默认导出「纯数组」，队友的任何代码都能直接读
    }

    return JSON.stringify(payload, null, o.indent);
  }

  var CSV_COLUMNS = [
    { key: 'date', label: '日期' },
    { key: 'type', label: '类型' },
    { key: 'category', label: '类别' },
    { key: 'amount', label: '金额' },
    { key: 'note', label: '备注' }
  ];

  function csvCell(value) {
    if (value === null || value === undefined) return '';
    var s = String(value);
    if (/[",\r\n]/.test(s)) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function toCSV(records, opts) {
    var o = mergeOptions(opts);
    var list = presentRecords(normalize(records), o);
    var lines = [];
    var i, j;

    var header = [];
    for (j = 0; j < CSV_COLUMNS.length; j++) header.push(CSV_COLUMNS[j].label);
    lines.push(header.join(','));

    for (i = 0; i < list.length; i++) {
      var row = [];
      for (j = 0; j < CSV_COLUMNS.length; j++) {
        row.push(csvCell(list[i][CSV_COLUMNS[j].key]));
      }
      lines.push(row.join(','));
    }

    // \uFEFF：让 Excel 用 UTF-8 打开，中文不乱码
    return '\uFEFF' + lines.join('\r\n');
  }

  /* ------------------------------------------------------------------ *
   * 三、让浏览器把内容存成文件
   * ------------------------------------------------------------------ */
  function saveBlob(content, fileName, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');

    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    // 兼容需要真实节点在文档里才能触发下载的浏览器
    document.body.appendChild(a);
    a.click();

    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* ------------------------------------------------------------------ *
   * 四、轻量提示（不依赖 style.css，也不弹 blocking 的 alert）
   * ------------------------------------------------------------------ */
  /**
   * 读 style.css 里的 CSS 变量，让提示条和团队配色一致；
   * 取不到（没有样式表 / 单元测试环境）就用内置兜底色。
   */
  function cssVar(name, fallback) {
    try {
      if (typeof getComputedStyle === 'function' && document.documentElement) {
        var value = getComputedStyle(document.documentElement).getPropertyValue(name);
        if (value && value.trim()) return value.trim();
      }
    } catch (err) {
      // 忽略：取不到就用兜底色
    }
    return fallback;
  }

  function toast(message, isError) {
    if (typeof document === 'undefined' || !document.body) {
      if (typeof console !== 'undefined') console.log('[export.js] ' + message);
      return;
    }

    var color = isError ? cssVar('--expense', '#d9534f') : cssVar('--primary', '#2d7ef7');

    var el = document.createElement('div');
    el.textContent = message;
    el.setAttribute('role', 'status');
    el.style.cssText =
      'position:fixed;left:50%;bottom:36px;transform:translateX(-50%);' +
      'max-width:70vw;padding:10px 18px;border-radius:8px;font-size:14px;' +
      'line-height:1.5;color:#fff;z-index:9999;box-shadow:0 6px 18px rgba(0,0,0,.25);' +
      'transition:opacity .25s;background:' + color + ';';

    document.body.appendChild(el);

    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, 2200);
  }

  /* ------------------------------------------------------------------ *
   * 五、对外动作
   * ------------------------------------------------------------------ */
  function exportJSON(opts) {
    var o = mergeOptions(opts);
    var list = normalize(readRecords());

    if (!list.length) {
      toast('当前没有可导出的账目', true);
      return false;
    }

    try {
      saveBlob(toJSON(list, o), o.fileName, 'application/json;charset=utf-8');
      toast('已导出 ' + list.length + ' 条记录 → ' + o.fileName);
      return true;
    } catch (err) {
      if (typeof console !== 'undefined') console.error('[export.js] 导出失败', err);
      toast('导出失败：' + (err && err.message ? err.message : '未知错误'), true);
      return false;
    }
  }

  function exportCSV(opts) {
    var o = mergeOptions(opts);
    var list = normalize(readRecords());

    if (!list.length) {
      toast('当前没有可导出的账目', true);
      return false;
    }

    try {
      saveBlob(toCSV(list, o), o.csvFileName, 'text/csv;charset=utf-8');
      toast('已导出 ' + list.length + ' 条记录 → ' + o.csvFileName);
      return true;
    } catch (err) {
      if (typeof console !== 'undefined') console.error('[export.js] CSV 导出失败', err);
      toast('导出失败：' + (err && err.message ? err.message : '未知错误'), true);
      return false;
    }
  }

  /* ------------------------------------------------------------------ *
   * 六、绑定按钮
   * ------------------------------------------------------------------ */
  function markBind(node, handler) {
    if (!node || node.__ledgerExportBound) return 0;
    node.__ledgerExportBound = true;
    node.addEventListener('click', function (e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      handler();
    });
    return 1;
  }

  function init() {
    if (typeof document === 'undefined') return 0;

    var count = 0;
    var i;

    // 约定 1：按钮带 data-export="json" 或 data-export="csv"
    var marked = document.querySelectorAll('[data-export]');
    for (i = 0; i < marked.length; i++) {
      (function (node) {
        var mode = node.getAttribute('data-export');
        count += markBind(node, function () {
          if (mode === 'csv') exportCSV(); else exportJSON();
        });
      })(marked[i]);
    }

    // 约定 2：按钮 id 为 exportBtn / exportCsvBtn（团队默认约定）
    var jsonIds = ['exportBtn', 'export-btn', 'exportJsonBtn'];
    for (i = 0; i < jsonIds.length; i++) {
      count += markBind(document.getElementById(jsonIds[i]), function () { exportJSON(); });
    }

    var csvIds = ['exportCsvBtn', 'export-csv-btn'];
    for (i = 0; i < csvIds.length; i++) {
      count += markBind(document.getElementById(csvIds[i]), function () { exportCSV(); });
    }

    if (!count && typeof console !== 'undefined') {
      console.warn('[export.js] 页面上没找到导出按钮，请在 index.html 加上：' +
        '<button id="exportBtn">导出数据</button>');
    }

    return count;
  }

  /* ------------------------------------------------------------------ *
   * 七、导出 API & 自动启动
   * ------------------------------------------------------------------ */
  var api = {
    config: CONFIG,
    readRecords: readRecords,
    normalize: normalize,
    toJSON: toJSON,
    toCSV: toCSV,
    exportJSON: exportJSON,
    exportCSV: exportCSV,
    init: init,
    toast: toast
  };

  if (typeof window !== 'undefined') {
    window.LedgerExport = api;

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // 供 Node 单测使用
  }
})();
