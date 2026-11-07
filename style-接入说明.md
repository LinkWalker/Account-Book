# 公共样式接入说明

`style.css` 提供全局配色、排版、表单、表格、按钮及移动端样式。以下新增类名是接入约定，列表和统计模块整合时需要对应添加。

## 1. 主页面引入（李韩远）

当 `index.html` 与 `style.css` 位于同一目录时，在 `<head>` 中加入：

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="./style.css">
```

主内容可放在 `<main class="container">` 内；普通区块使用 `.card`。`.ledger-form-section` 已自带卡片样式，不需要重复套卡片。样式没有外部字体或 CSS 库依赖。

## 2. 表单接入（林豪、翁齐文）

已按现有 `form.html` 中的类名编写，包括 `.form-row`、`.form-control`、`.type-switch`、`.amount-field` 和 `.form-actions`。保留现有 ID，方便业务脚本绑定。

- 校验失败：给输入框设置 `aria-invalid="true"`；校验通过后移除或设为 `false`。
- 提示文字写入 `#formTip`，默认显示为错误色；成功提示添加 `success` 类，后续错误提示需移除此类。
- 保存期间给按钮设置原生 `disabled` 属性，完成后恢复。
- 样式只负责展示；金额校验、保存、清空和事件监听由 `form.js` 完成。

## 3. 表格接入（肖志渊、马天鸿）

表格外层加 `.table-wrapper`，手机端可以在容器内横向滚动。金额列的表头和单元格加 `.amount`，收入使用 `.income`，支出使用 `.expense`。

下面仅演示结构与样式，记录内容应由业务脚本生成：

```html
<div class="table-wrapper">
  <table>
    <thead>
      <tr>
        <th scope="col">日期</th>
        <th scope="col" class="amount">金额</th>
        <th scope="col">类别</th>
        <th scope="col">备注</th>
        <th scope="col">操作</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>2026-11-07</td>
        <td class="amount expense">-¥18.00</td>
        <td>饮食</td>
        <td>午饭</td>
        <td><button type="button" class="btn btn-danger btn-sm">删除</button></td>
      </tr>
    </tbody>
  </table>
</div>
```

无记录时可在表格中插入 `<tr><td colspan="5" class="empty-state">暂无记账记录</td></tr>`。业务模块已有 ID、数据属性和删除事件约定应继续保留；添加样式类不需要替换这些约定。

## 4. 按钮与公共组件

| 场景 | 类名 | 对接模块 |
| --- | --- | --- |
| 保存、主要操作 | `btn btn-primary` | 表单 |
| 清空、次要操作 | `btn btn-ghost` 或 `btn btn-secondary` | 表单、导出、筛选 |
| 删除 | `btn btn-danger btn-sm` | 列表 |
| 工具栏 | `toolbar` | 筛选、导出 |
| 输入框、下拉框 | `form-control` | 表单、筛选 |
| 统计区域 | `stats-grid` | 统计 |
| 统计卡片 | `card` | 统计 |
| 统计标题 | `stat-label` | 统计 |
| 统计数值 | `stat-value`，按语义搭配 `income` / `expense` | 统计 |

表单内非提交按钮请设置 `type="button"`；清空表单按钮使用 `type="reset"`。仅添加 `.disabled` 或 `aria-disabled="true"` 只改变外观，业务代码仍需阻止操作，优先使用原生按钮的 `disabled` 属性。

统计卡片默认三列，屏幕宽度不超过 600px 时变为一列。图表容器的高度、ECharts 初始化和窗口变化后的 `resize()` 由图表模块负责，当前公共 CSS 未设置图表专用样式。

## 5. 配色与整合检查

统一配色在 `style.css` 顶部的 `:root` 中维护：`--primary` 为主色，`--background` 为背景色，`--text` 为文字色，`--income` 为收入色，`--expense` 为支出色。金额建议保留正负号或收支文字，便于同时通过文字和颜色识别。

全局规则会作用于原生 `button`、`table`、标题及输入控件，整合其他组件时需检查是否存在覆盖冲突。

当前已按本地 `form.html` 核对类名；完整 `index.html` 尚未接入，尚未完成浏览器视觉及交互验证。合并后请检查：

- CSS 路径可访问、页面正常加载样式。
- 表单、列表、统计卡片使用约定类名，删除和保存等原有逻辑正常。
- 桌面及手机宽度下排版正常，长备注不会撑破页面，表格可横向滚动。
- 键盘 Tab 焦点可见，收支切换和按钮禁用状态清楚。
