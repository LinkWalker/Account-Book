/**
 * 梁洪睿：账本数据存储模块。
 * 在 index.html 中先引入本文件，再引入 form.js、list.js 等调用方。
 * saveData(records)：保存完整记录数组，成功返回 true，失败返回 false。
 * getData()：读取记录数组；无数据、格式错误或读取失败时返回 []。
 */
(function () {
    'use strict';

    // 保存和读取必须使用同一个键名。
    const STORAGE_KEY = 'accountBookData';

    function saveData(records) {
        saveData.lastError = null;
        try {
            if (!Array.isArray(records)) {
                throw new TypeError('账本数据必须是数组');
            }

            const json = JSON.stringify(records);
            localStorage.setItem(STORAGE_KEY, json);
            return true;
        } catch (error) {
            // 存储空间不足、浏览器限制或数据无法序列化时，不报告保存成功。
            saveData.lastError = error.message;
            console.error('保存账本数据失败：', error);
            return false;
        }
    }

    function getData() {
        getData.lastError = null;
        try {
            const json = localStorage.getItem(STORAGE_KEY);
            if (json === null) {
                return [];
            }

            const records = JSON.parse(json);
            if (!Array.isArray(records)) {
                throw new TypeError('已保存的账本数据不是数组');
            }

            return records;
        } catch (error) {
            // 读取失败时不主动覆盖或删除原始存储内容。
            getData.lastError = error.message;
            console.error('读取账本数据失败：', error);
            return [];
        }
    }

    // 普通 script 标签引入后，其他文件可直接调用这两个函数。
    window.saveData = saveData;
    window.getData = getData;
    window.LedgerStorage = { saveData: saveData, getData: getData };
}());
