const MENU_ID = 'meltbead-image-pattern';

function installMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Create a bead pattern with Meltbead',
      contexts: ['image'],
    });
  });
}

chrome.runtime.onInstalled.addListener(installMenu);
chrome.runtime.onStartup.addListener(installMenu);

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;
  const id = crypto.randomUUID();
  await chrome.storage.session.set({ [id]: info.srcUrl });
  await chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html#${id}`) });
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
});
