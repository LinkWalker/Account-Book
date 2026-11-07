/** 账目类别筛选。普通 script 引入后通过 LedgerFilter 调用。 */
(function (root) {
  'use strict';

  /** 空字符串表示全部类别；始终返回新数组，不改变原记录及其顺序。 */
  function filterByCategory(records, category) {
    if (!Array.isArray(records)) throw new TypeError('账目数据必须为数组');
    if (typeof category !== 'string') throw new TypeError('类别必须为字符串');
    return records.filter(function (record) {
      return category === '' || record.category === category;
    });
  }

  function filterRecords(records) {
    function value(id) {
      var field = root.document.getElementById(id);
      return field ? field.value : '';
    }
    var date = value('filterDate');
    var min = value('filterMinAmount');
    var max = value('filterMaxAmount');
    return filterByCategory(records, value('filterCategory')).filter(function (record) {
      return (!date || record.date === date) &&
        (min === '' || record.amount / 100 >= Number(min)) &&
        (max === '' || record.amount / 100 <= Number(max));
    });
  }

  /** 在筛选框加载后调用一次；返回刷新函数，供新增、删除成功后调用。 */
  function init(getData, renderList) {
    if (typeof getData !== 'function' || typeof renderList !== 'function') {
      throw new TypeError('必须提供读取账目和渲染列表的函数');
    }
    var select = root.document.getElementById('filterCategory');
    if (!select) throw new Error('未找到类别筛选框 #filterCategory');

    function refresh() {
      var records = filterRecords(getData());
      renderList(records);
      root.document.dispatchEvent(new CustomEvent('records:filtered'));
      return records;
    }

    refresh();
    select.addEventListener('change', refresh);
    ['filterDate', 'filterMinAmount', 'filterMaxAmount'].forEach(function (id) {
      var field = root.document.getElementById(id);
      if (field) field.addEventListener('input', refresh);
    });
    return refresh;
  }

  var api = Object.freeze({ filterByCategory: filterByCategory, filterRecords: filterRecords, init: init });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LedgerFilter = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
