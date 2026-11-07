# 类别筛选接入说明

## 页面接入

把 `filter.html` 中的区块放到 `index.html` 的账目列表上方，样式由现有 `style.css` 统一管理。筛选框 ID 为 `filterCategory`，与录入表单的 `recordCategory` 独立。

在页面区块及依赖脚本加载后初始化一次，例如放在 `</body>` 前：

```html
<script src="storage.js"></script>
<script src="list.js"></script>
<script src="filter.js"></script>
<script>
  var refreshFilteredList = LedgerFilter.init(getData, renderList);
</script>
```

以上 `getData`、`renderList` 是待与存储、列表负责人确认的接口名称，脚本路径也应按合并后的实际目录调整。本模块不依赖 `utils.js`。

## 数据与列表接口

- `getData()`：同步返回最新的完整账目数组，无记录时返回 `[]`。
- 每条记录通过 `category` 字段存储中文类别，与 `form.html` 的 option value 完全一致，例如 `{ id: 'r1', category: '饮食' }`；其他字段由筛选模块原样传递。
- `renderList(records)`：用传入数组替换当前列表；收到 `[]` 时清空旧行并显示“暂无记录”。不要在此函数内部重新读取完整数据覆盖筛选结果。
- 删除按钮应保留原记录唯一 ID，按 ID 删除，不能使用筛选结果的数组下标定位存储记录。

初始化会立即渲染一次；切换类别时会重新读取最新数据并渲染。选择空字符串 `""` 表示全部类别。筛选只返回新数组，不修改原记录、不写入存储，不改变统计、图表或导出的数据来源。

## 新增、删除后的刷新

新增或删除记录保存成功后，调用初始化返回的刷新函数，以保留当前筛选条件：

```js
// 在现有新增或删除流程保存成功后调用：
refreshFilteredList();
```

原来直接刷新完整列表的调用应在整合时替换为此调用，避免覆盖筛选结果。初始化应在注册依赖该刷新函数的业务流程前完成。存储、渲染错误会向调用方抛出，由页面现有错误提示流程处理。

## 单独使用筛选函数

```js
var records = [
  { id: 'r1', category: '饮食' },
  { id: 'r2', category: '交通' }
];
LedgerFilter.filterByCategory(records, '饮食'); // 仅 r1
LedgerFilter.filterByCategory(records, ''); // 全部记录的新数组
```

## 联调检查

1. 初次打开显示全部记录；选择“饮食”后只显示饮食记录。
2. 切换其他类别、切回“全部类别”，结果与存储数据一致。
3. 无匹配类别或空账本时清空旧列表，显示空状态。
4. 筛选期间新增、删除后调用刷新函数，类别选择保持不变。
5. 筛选后删除中间一条记录，确认按唯一 ID 删除正确记录。
6. 切换类别不改变存储内容，类别选项与录入表单一致。

当前仓库尚无 `storage.js`、`list.js`、`index.html`；完整页面接入及上述联调需在对应模块合并后进行。
