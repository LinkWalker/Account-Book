/**
 * chart.js — 收支分类饼图（核心加分项）
 * 作者：丘南星
 * 功能：接收林晓捷 stats.js 计算好的分类数据，用 ECharts 渲染成漂亮的环形饼图
 * 依赖：stats.js（getCategoryStats()）、ECharts CDN
 *
 * 【接口约定】和林晓捷对齐：
 * stats.js 必须提供全局函数 getCategoryStats()，返回格式：
 * {
 *   expense: [{ name: '餐饮', value: 123.45 }, ...],   // 支出分类数组
 *   income:  [{ name: '工资', value: 5000.00 }, ...]   // 收入分类数组
 * }
 *
 * stats.js 每次计算完数据后，调用一次 onStatsUpdated()，chart.js 会自动刷新。
 */

// ========== 全局变量 ==========
let pieChart = null;          // ECharts 实例
let currentTab = 'expense';   // 当前展示的 tab：expense=支出，income=收入
let latestStats = null;       // 缓存最近一次拿到的统计数据

// 支出类别配色（温暖色系）
const EXPENSE_COLORS = [
    '#FF6B6B', '#FFA07A', '#FFD93D', '#6BCB77',
    '#4D96FF', '#9B59B6', '#FF6FB5', '#74B9FF'
];

// 收入类别配色（清新色系）
const INCOME_COLORS = [
    '#2ECC71', '#27AE60', '#1ABC9C', '#3498DB', '#9B59B6'
];

// ========== 初始化 ==========
function initChart() {
    const chartDom = document.getElementById('chartPie');
    if (!chartDom) {
        console.error('[chart.js] 找不到 #chartPie 容器');
        return;
    }

    pieChart = echarts.init(chartDom);

    // 创建 tab 切换按钮
    createTabs();

    // 首次尝试渲染（等 stats.js 数据）
    tryRender();

    // 窗口大小变化时自适应
    window.addEventListener('resize', () => {
        if (pieChart) pieChart.resize();
    });

    console.log('[chart.js] 饼图初始化完成，等待 stats.js 数据...');
}

// ========== 创建 Tab 切换按钮（支出/收入） ==========
function createTabs() {
    const chartSection = document.querySelector('.chart-section');
    if (!chartSection) return;

    if (document.getElementById('chartTabs')) return; // 已存在则跳过

    const tabsHtml = `
        <div class="chart-tabs" id="chartTabs">
            <button class="chart-tab active" data-tab="expense">支出分类</button>
            <button class="chart-tab" data-tab="income">收入分类</button>
        </div>
    `;
    chartSection.insertAdjacentHTML('afterbegin', tabsHtml);

    document.querySelectorAll('.chart-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            tryRender();
        });
    });
}

// ========== 外部入口：stats.js 数据更新时调用 ==========
// 林晓捷：你每次算完分类统计，就调一次这个函数，我这边自动刷新
function onStatsUpdated(stats) {
    latestStats = stats;
    console.log('[chart.js] 收到新数据', stats);
    tryRender();
}

// ========== 尝试渲染（数据就绪才画） ==========
function tryRender() {
    if (!pieChart) return;

    // 优先用 onStatsUpdated 传进来的数据
    // 兜底：如果 stats.js 已经加载了，就主动调 getCategoryStats()
    if (!latestStats && typeof getCategoryStats === 'function') {
        latestStats = getCategoryStats();
    }

    if (!latestStats) {
        // 数据还没到，画个空状态
        pieChart.setOption(buildEmptyOption(), true);
        return;
    }

    const pieData = currentTab === 'expense' ? latestStats.expense : latestStats.income;
    const option = buildChartOption(pieData || [], currentTab);
    pieChart.setOption(option, true);
}

// ========== 构建 ECharts 配置 ==========
function buildChartOption(pieData, type) {
    const isExpense = type === 'expense';
    const colors = isExpense ? EXPENSE_COLORS : INCOME_COLORS;
    const total = pieData.reduce((sum, item) => sum + item.value, 0);

    return {
        title: {
            text: isExpense ? '支出构成' : '收入构成',
            subtext: `总计：¥${total.toFixed(2)}`,
            left: 'center',
            top: 10,
            textStyle: { fontSize: 18, fontWeight: 600, color: '#333' },
            subtextStyle: { fontSize: 14, color: isExpense ? '#e74c3c' : '#27ae60' }
        },

        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                const percent = total > 0 ? ((params.value / total) * 100).toFixed(1) : 0;
                return `<strong>${params.name}</strong><br/>
                        金额：¥${params.value.toFixed(2)}<br/>
                        占比：${percent}%`;
            },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#eee',
            borderWidth: 1,
            textStyle: { color: '#333', fontSize: 13 },
            extraCssText: 'box-shadow: 0 2px 12px rgba(0,0,0,0.1); border-radius: 8px;'
        },

        legend: {
            orient: 'horizontal',
            bottom: 10,
            left: 'center',
            itemWidth: 12,
            itemHeight: 12,
            textStyle: { fontSize: 12, color: '#666' },
            type: pieData.length > 6 ? 'scroll' : 'plain'
        },

        series: [{
            name: isExpense ? '支出分类' : '收入分类',
            type: 'pie',
            radius: ['40%', '65%'],
            center: ['50%', '52%'],
            avoidLabelOverlap: true,
            itemStyle: {
                borderRadius: 8,
                borderColor: '#fff',
                borderWidth: 3
            },
            label: {
                show: true,
                formatter: '{b}\n{d}%',
                fontSize: 12,
                color: '#555',
                lineHeight: 18
            },
            labelLine: {
                show: true,
                length: 15,
                length2: 10,
                smooth: true
            },
            emphasis: {
                label: { show: true, fontSize: 14, fontWeight: 'bold' },
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.2)'
                }
            },
            data: pieData,
            color: colors
        }]
    };
}

// ========== 空状态配置 ==========
function buildEmptyOption() {
    return {
        title: {
            text: '暂无数据',
            subtext: '等待统计数据加载...',
            left: 'center',
            top: 'middle',
            textStyle: { fontSize: 16, color: '#999' },
            subtextStyle: { fontSize: 13, color: '#bbb' }
        }
    };
}

// ========== 页面加载完成后初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    // 等 stats.js 先加载完
    setTimeout(initChart, 200);
});
