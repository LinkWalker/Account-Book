/**
 * stats.js —— 林晓捷
 * 计算总收入、总支出、总结余，并更新到页面顶部三张统计卡片
 * 同时按类别汇总支出数据，供 chart.js（丘南星）画饼图使用
 */
(function (global) {
  'use strict';

  function compute(records) {
    let income = 0, expense = 0;
    const expenseByCategory = {}; // { 餐饮: 120, 交通: 50, ... }
    (records || []).forEach(function (r) {
      const amt = Number(r.amount) || 0;
      if (r.type === 'income') {
        income += amt;
      } else {
        expense += amt;
        expenseByCategory[r.category || '其他'] = (expenseByCategory[r.category || '其他'] || 0) + amt;
      }
    });
    return {
      income: income,
      expense: expense,
      balance: income - expense,
      expenseByCategory: expenseByCategory
    };
  }
  function render() {
    const records = (typeof global.getData === 'function') ? global.getData() : [];
    const s = compute(records);

    const money = global.Utils ? global.Utils.formatMoney : function (n) { return '¥' + n.toFixed(2); };
    const elIncome = document.getElementById('stat-income');
    const elExpense = document.getElementById('stat-expense');
    const elBalance = document.getElementById('stat-balance');
    if (elIncome) elIncome.textContent = money(s.income);
    if (elExpense) elExpense.textContent = money(s.expense);
    if (elBalance) elBalance.textContent = money(s.balance);

    // 把分类支出数据挂到 window，供 chart.js 读取
    global.__ledgerStats = s;

    // 通知 chart.js 刷新
    document.dispatchEvent(new CustomEvent('stats:updated', { detail: s }));
  }

  function init() {
    render();
    document.addEventListener('records:changed', render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
