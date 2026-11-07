/**
 * form.js —— 记账本「录入表单」逻辑。负责人：翁齐文。
 *
 * 接入顺序（放在 form.html 区块之后）：
 *   <script src="utils.js"></script>
 *   <script src="storage.js"></script>   <!-- 梁洪睿，提供 LedgerStorage -->
 *   <script src="form.js"></script>
 *
 * 依赖约定（两个都必须满足，否则不写入数据，只在 #formTip 提示）：
 *   LedgerUtils.formatDate(value)   -> 'YYYY-MM-DD'（本地时区，utils.js 已实现）
 *   LedgerUtils.moneyToCents(text)  -> 整数「分」，非法输入抛异常
 *   LedgerUtils.centsToMoney(cents) -> '12.30'，仅用于提示文案
 *   LedgerStorage.getData()         -> 记录数组（无数据返回 []）
 *   LedgerStorage.saveData(list)    -> 覆盖写入
 *   localStorage key：accountBookData，值为 JSON 数组
 *
 * 记录字段（全队唯一口径，list/stats/chart/filter 都必须按这个读）：
 *   id        string   唯一 id
 *   type      string   'expense' | 'income'
 *   date      string   'YYYY-MM-DD'
 *   amount    number   整数，单位「分」（不是元！展示用 centsToMoney）
 *   category  string   中文类别名，见下方常量
 *   note      string   可为空字符串
 *   createdAt number   毫秒时间戳
 *
 * 保存成功后派发事件，其余模块监听即可，不要互相调用：
 *   document.addEventListener('ledger:change', e => { e.detail.records })
 */
(function (root) {
  'use strict';

  // 类别与 form.html 的 optgroup 一致；收入/支出分开校验，防止「工资」被记成支出
  var EXPENSE_CATEGORIES = ['饮食', '交通', '购物', '娱乐', '学习', '医疗', '居住', '其他支出'];
  var INCOME_CATEGORIES = ['工资', '兼职', '理财', '红包', '其他收入'];

  var TIP_SUCCESS = 'success';
  var TIP_ERROR = 'error';
  var initialized = false;

  /** 取元素；form.html 的 id 是唯一约定，取不到就静默返回 null，不抛异常。 */
  function el(id) {
    return document.getElementById(id);
  }

  /** 写 #formTip；level 决定 class 后缀，交给 style.css 处理颜色。 */
  function setTip(text, level) {
    var tip = el('formTip');
    if (!tip) return;
    tip.textContent = text || '';
    tip.className = 'form-tip' + (level ? ' form-tip--' + level : '');
    tip.setAttribute('data-level', level || '');
  }

  /** 读取当前选中的收支类型；income 单选框没有 id，所以按 name 查。 */
  function readType() {
    var checked = document.querySelector('input[name="recordType"]:checked');
    return checked && checked.value === 'income' ? 'income' : 'expense';
  }

  /** 把类型单选框同步成指定值（只改 checked，不触发事件，避免递归）。 */
  function applyType(type) {
    var radios = document.querySelectorAll('input[name="recordType"]');
    Array.prototype.forEach.call(radios, function (radio) {
      radio.checked = radio.value === type;
    });
  }

  /**
   * 按类型禁用不匹配的类别，从源头上避免「支出 + 工资」这种脏数据。
   * 若已选类别被禁用，回到「请选择类别」占位项。
   */
  function syncCategories(type) {
    var select = el('recordCategory');
    if (!select) return;
    var allowed = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    Array.prototype.forEach.call(select.options, function (option) {
      if (option.value === '') {
        option.disabled = false;
        return;
      }
      var match = allowed.indexOf(option.value) !== -1;
      option.disabled = !match;
      if (!match && option.selected) select.value = '';
    });
  }

  /** 从表单读出原始字符串，不在这里做转换。 */
  function readInput() {
    var category = el('recordCategory');
    var note = el('recordNote');
    var date = el('recordDate');
    var amount = el('recordAmount');
    return {
      type: readType(),
      date: date ? date.value : '',
      amount: amount ? amount.value : '',
      category: category ? category.value : '',
      note: note ? note.value : ''
    };
  }

  /**
   * 校验原始输入。成功返回 { ok: true, value: {...} }，失败返回 { ok: false, msg, field }。
   * field 用于把焦点打回出错的那一项。
   */
  function validate(raw) {
    var type = raw.type === 'income' ? 'income' : 'expense';

    if (!raw.date) return { ok: false, msg: '请先选择日期', field: 'recordDate' };
    var date;
    try {
      date = LedgerUtils.formatDate(raw.date);
    } catch (error) {
      return { ok: false, msg: '日期不合法，请重新选择', field: 'recordDate' };
    }

    if (!raw.amount) return { ok: false, msg: '请输入金额', field: 'recordAmount' };
    var cents;
    try {
      cents = LedgerUtils.moneyToCents(raw.amount);
    } catch (error) {
      return { ok: false, msg: '金额只能是数字，最多两位小数', field: 'recordAmount' };
    }
    if (cents <= 0) return { ok: false, msg: '金额必须大于 0', field: 'recordAmount' };

    if (!raw.category) return { ok: false, msg: '请选择类别', field: 'recordCategory' };
    var allowed = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (allowed.indexOf(raw.category) === -1) {
      return {
        ok: false,
        msg: '「' + raw.category + '」和当前收支类型不匹配，请切换类型',
        field: 'recordCategory'
      };
    }

    // 备注可选：折叠空白、去首尾、按 form.html 的 maxlength 截断，避免超长文本撑坏表格
    var note = String(raw.note || '').replace(/\s+/g, ' ').trim().slice(0, 30);

    return {
      ok: true,
      value: { type: type, date: date, amountCents: cents, category: raw.category, note: note }
    };
  }

  /** 生成唯一 id：时间戳 + 随机串，足够单机记账本使用。 */
  function createId() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** 组装最终落库的记录，字段与文件头约定完全一致。 */
  function buildRecord(value) {
    return {
      id: createId(),
      type: value.type,
      date: value.date,
      amount: value.amountCents,
      category: value.category,
      note: value.note,
      createdAt: Date.now()
    };
  }

  /** storage.js 是否已接入；没接入就不写数据，避免写坏别人的存储格式。 */
  function storageReady() {
    return !!(root.LedgerStorage &&
      typeof root.LedgerStorage.getData === 'function' &&
      typeof root.LedgerStorage.saveData === 'function');
  }

  /** 读出现有记录 → 追加 → 写回；返回写入后的完整数组，供事件携带。 */
  function appendRecord(record) {
    var list = root.LedgerStorage.getData();
    if (root.LedgerStorage.getData.lastError) {
      throw new Error('读取账本失败，未覆盖原数据：' + root.LedgerStorage.getData.lastError);
    }
    if (!Array.isArray(list)) throw new Error('账本数据格式错误');
    list.push(record);
    if (root.LedgerStorage.saveData(list) !== true) {
      throw new Error(root.LedgerStorage.saveData.lastError || '本地存储写入失败');
    }
    return list;
  }

  /** 通知其它模块刷新；事件失败不能影响“已保存”这个事实。 */
  function notify(records) {
    var detail = { records: records, source: 'form' };
    try {
      document.dispatchEvent(new CustomEvent('ledger:change', { detail: detail }));
    } catch (error) {
      var legacy = document.createEvent('CustomEvent');
      legacy.initCustomEvent('ledger:change', true, false, detail);
      document.dispatchEvent(legacy);
    }
  }

  /** 清空表单但保留日期为今天，方便连续记账；提示文案由调用方决定。 */
  function resetForm() {
    var form = el('ledgerForm');
    // 注意：form.reset() 会同步触发 reset 事件，onReset 里会清空提示，
    // 所以成功文案必须在 resetForm() 之后才写。
    if (form && typeof form.reset === 'function') form.reset();
    applyType('expense');
    syncCategories('expense');
    setDefaultDate();
  }

  /** 日期默认值用本地今天，不能用 toISOString（东八区凌晨会差一天）。 */
  function setDefaultDate() {
    var dateInput = el('recordDate');
    if (!dateInput || dateInput.value) return;
    try {
      dateInput.value = LedgerUtils.formatDate();
    } catch (error) {
      dateInput.value = '';
    }
  }

  /** 保存成功后的提示：日期、类别、带正负号的金额。 */
  function successMessage(record) {
    var sign = record.type === 'income' ? '+' : '-';
    var money = LedgerUtils.centsToMoney(record.amount);
    return '已保存：' + record.date + ' ' + record.category + ' ' + sign + money + ' 元';
  }

  function onSubmit(event) {
    // novalidate 已关闭浏览器原生校验，这里必须自己拦截
    event.preventDefault();
    setTip('', '');

    if (!storageReady()) {
      setTip('数据模块未接入（storage.js），请先确认 LedgerStorage 已加载', TIP_ERROR);
      return;
    }

    var result = validate(readInput());
    if (!result.ok) {
      setTip(result.msg, TIP_ERROR);
      if (result.field) {
        var field = el(result.field);
        if (field && typeof field.focus === 'function') field.focus();
      }
      return;
    }

    var record = buildRecord(result.value);
    var records;
    try {
      records = appendRecord(record);
    } catch (error) {
      setTip('保存失败：' + ((error && error.message) || '本地存储写入异常'), TIP_ERROR);
      return;
    }

    var message = successMessage(record);
    notify(records);

    // 先重置（reset 事件会清空提示），再写成功文案，最后把焦点放回金额
    resetForm();
    setTip(message, TIP_SUCCESS);
    var amountInput = el('recordAmount');
    if (amountInput && typeof amountInput.focus === 'function') amountInput.focus();
  }

  function onReset() {
    // reset 事件先于值清空触发，用 setTimeout 让默认日期生效
    setTip('', '');
    setTimeout(function () {
      applyType('expense');
      syncCategories('expense');
      setDefaultDate();
    }, 0);
  }

  function onTypeChange() {
    syncCategories(readType());
    setTip('', '');
  }

  /** 绑定事件；重复调用不会重复绑定。 */
  function init() {
    var form = el('ledgerForm');
    if (!form || initialized) return;
    initialized = true;

    setDefaultDate();
    syncCategories(readType());

    form.addEventListener('submit', onSubmit);
    form.addEventListener('reset', onReset);

    Array.prototype.forEach.call(
      document.querySelectorAll('input[name="recordType"]'),
      function (radio) {
        radio.addEventListener('change', onTypeChange);
      }
    );

    // 用户一改动就抹掉上一条错误提示，避免旧提示误导
    ['recordDate', 'recordAmount', 'recordCategory', 'recordNote'].forEach(function (id) {
      var field = el(id);
      if (!field) return;
      field.addEventListener('input', function () {
        setTip('', '');
      });
      field.addEventListener('change', function () {
        setTip('', '');
      });
    });
  }

  root.LedgerForm = Object.freeze({
    init: init,
    validate: validate,
    buildRecord: buildRecord,
    categories: Object.freeze({
      expense: EXPENSE_CATEGORIES.slice(),
      income: INCOME_CATEGORIES.slice()
    })
  });

  // 脚本可能被拼到 body 末尾（DOM 已就绪），也可能放在 head（需等 DOM）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
