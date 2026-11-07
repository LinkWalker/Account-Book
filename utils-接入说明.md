# 公共工具接入说明

在使用工具的业务脚本之前引入：

```html
<script src="utils.js"></script>
```

统一通过 `LedgerUtils` 调用：

```js
LedgerUtils.formatDate(); // 本地今天，YYYY-MM-DD
LedgerUtils.formatDate('2026-11-07'); // 2026-11-07
LedgerUtils.moneyToCents('12.30'); // 1230，用整数分计算避免浮点误差
LedgerUtils.centsToMoney(-1230); // -12.30
const refresh = LedgerUtils.debounce(function () { /* 刷新筛选结果 */ }, 300);
// 输入事件中调用 refresh()；需要时 refresh.cancel() 或 refresh.flush()
LedgerUtils.escapeHtml('<备注>'); // &lt;备注&gt;
```

日期只接受 Date、毫秒时间戳或严格的 YYYY-MM-DD 字符串；不修改传入的 Date。金额转换允许零，是否要求金额大于零由表单模块判断。非法日期、金额会抛出异常，业务层应捕获并提示用户。展示备注优先使用 DOM 的 textContent；escapeHtml 只用于 HTML 文本内容。

金额函数仅提供转换能力，不改变 storage.js 的存储字段约定。团队应统一金额单位后再接入，避免元、分混用。

合并时保留本文件为独立模块，由骨架负责人添加 script 标签。当前目录尚无其他成员代码及 Git 仓库，因此暂无可处理的实际合并冲突。
