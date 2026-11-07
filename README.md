# Account-Book

个人记账本，使用浏览器 localStorage 保存记录，支持收支录入、类别筛选、汇总、分类图表和 JSON/CSV 导出。

## 本地运行

在项目目录启动静态服务器，例如安装 Python 后执行：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8000/index.html`。保持相同的浏览器和访问地址，才能读取之前存入该来源的记录。ECharts 通过 CDN 加载；加载失败时会显示提示，不影响记账。

## 模块接口

- `storage.js` 提供 `getData()`、`saveData(records)` 及同名的 `LedgerStorage` 方法。保存成功返回 `true`，失败返回 `false`；调用后通过函数的 `lastError` 属性查看异常。
- `amount` 存储为整数分，例如 18 元存 `1800`。列表和统计卡片使用 `LedgerUtils.centsToMoney()` 展示；图表和导出金额换算为元。原表单已按分存储，本修复不改写历史记录或猜测手工数据的金额单位。
- 表单保存成功后派发 `ledger:change`，主页面桥接为 `records:changed`；列表和统计监听后者，失败时不派发成功事件。
- 统计卡片始终汇总全部记录，类别筛选仅影响列表。`stats:updated` 的 `detail.categoryStats` 提供以元为单位的收入、支出分类数组，供图表监听；`getCategoryStats()` 提供初始化读取。
- JSON、CSV 按钮分别下载 `data.json`、`data.csv`，导出全部记录。

## 验证

安装支持 `node:test` 的 Node.js 后运行：

```powershell
node --test tests/integration.test.cjs
```

测试使用模拟 DOM、localStorage 和 ECharts，覆盖金额单位、收支汇总、图表切换、刷新读取、表格列对齐、备注转义、增删后筛选、存储失败、损坏数据保护及两种导出按钮。真实浏览器的布局、键盘操作、下载及 ECharts CDN 加载仍需人工验证。
