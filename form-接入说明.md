# form.js 接入说明

## 1. 引入顺序

放在 `form.html` 区块**之后**，顺序不能颠倒：

```html
<script src="utils.js"></script>
<script src="storage.js"></script>   <!-- storage.js，提供 LedgerStorage -->
<script src="form.js"></script>
```

> `form.html` 里写的 `js/form.js` 是本项目的路径笔误：目前 `utils.js` 在仓库根目录，`form.js` 也放在根目录，请统一用 `src="form.js"`。

## 2. 依赖的两个接口（缺一不可）

`form.js` 不自已读写 localStorage，只调用 `storage.js`：

```js
LedgerStorage.getData()          // 返回记录数组；无数据必须返回 []
LedgerStorage.saveData(list)     // 整体覆盖写入，key = 'ledger_records'
```

`getData()` 返回非数组时 `form.js` 会当作空数组处理；`saveData` 抛异常时会在 `#formTip` 提示「保存失败」，不会静默丢失数据。若 `storage.js` 未加载，`form.js` 只提示、不写入，避免写坏别人的存储格式。

## 3. 记录字段（全队唯一口径）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一 id，由 `form.js` 生成，删除时按它定位 |
| `type` | string | `'expense'` 支出 / `'income'` 收入 |
| `date` | string | `YYYY-MM-DD`，本地日期 |
| `amount` | number | **整数，单位「分」**，如 12.30 元存 `1230` |
| `category` | string | 中文类别名 |
| `note` | string | 可为空字符串，已去首尾并折叠空白，最长 30 字 |
| `createdAt` | number | 毫秒时间戳 |

**金额是「分」不是「元」**，这是为了绕开 `0.1 + 0.2` 的浮点误差。展示一律走 `LedgerUtils.centsToMoney(record.amount)`：

```js
LedgerUtils.centsToMoney(1230)    // '12.30'
LedgerUtils.centsToMoney(-1230)   // '-12.30'
```

统计合计也用整数加减，最后再转成字符串。

## 4. 保存成功后的通知方式

其它模块**不要**去调用 `form.js` 或轮询，只监听这一个事件：

```js
document.addEventListener('ledger:change', function (e) {
  var records = e.detail.records;   // 写入后的完整数组
  // e.detail.source === 'form'
});
```

`list.js` 重画表格、`stats.js` 重算合计、`chart.js` 重画饼图、`filter.js` 重跑筛选，都挂在这一个事件上即可，互不干扰。

## 5. form.js 的行为（避免与 form.html 冲突）

- 日期默认值用 `LedgerUtils.formatDate()` 取**本地今天**，不用 `toISOString()`（东八区凌晨会差一天）。
- 切换收支类型时，会自动禁用另一类型的类别选项（支出下「工资」不可选），所以提交的数据不会出现「支出 + 工资」的矛盾。
- 校验规则：日期必填且必须真实存在；金额必填、最多两位小数、必须大于 0；类别必选且须与类型匹配。
- 校验失败时提示写在 `#formTip`，并把焦点打回出错的那个输入框；用户一改动输入，旧提示立即清除。
- 保存成功后清空表单、类型复位为「支出」、日期保持今天、焦点回到金额框，便于连续记账。
- 备注按纯文本处理（`textContent`），不拼 HTML，天然免疫备注里的 `<script>`。
- 重复调用 `LedgerForm.init()` 不会重复绑定事件。

## 6. 对外暴露

```js
LedgerForm.init()                  // 手动初始化（一般不需要，脚本加载时自动执行）
LedgerForm.validate(rawInput)      // 返回 { ok, msg, field } 或 { ok:true, value }
LedgerForm.buildRecord(value)      // 组装记录对象
LedgerForm.categories              // { expense: [...], income: [...] } 给 filter.js 复用
```

## 7. 交给 style.css 的类名

提示区用 `#formTip` 的 `class` 区分状态，样式只需覆盖这两种：

```css
.form-tip { }                 /* 普通状态 */
.form-tip--error { }          /* 校验失败 */
.form-tip--success { }        /* 保存成功 */
```

`#formTip` 上同时写了 `data-level="error|success|"`，用属性选择器也行。
