// WebTable Enhancer — background.js (Service Worker)
// Registers context menu items and relays clicks to the content script.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'wte-rich',
      title: 'テーブルをリッチ表示に変換',
      contexts: ['all']
    });
    chrome.contextMenus.create({
      id: 'wte-tree',
      title: 'テーブルをツリー表示に変換（レベル列）',
      contexts: ['all']
    });
    chrome.contextMenus.create({
      id: 'wte-reset',
      title: 'テーブルを元に戻す',
      contexts: ['all']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.tabs.sendMessage(tab.id, { action: info.menuItemId });
});
