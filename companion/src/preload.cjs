const { contextBridge, ipcRenderer } = require('electron');
const invoke = name => (...args) => ipcRenderer.invoke(name, ...args);
const subscribe = channel => listener => {
  const callback = (_event, value) => listener(value);
  ipcRenderer.on(channel, callback);
  return () => ipcRenderer.removeListener(channel, callback);
};
contextBridge.exposeInMainWorld('companion', {
  splitTwoRefresh:invoke('split-two-refresh'),splitTwoConnect:invoke('split-two-connect'),splitTwoDisconnect:invoke('split-two-disconnect'),onSplitTwo:subscribe('split-two-state'),
  state: invoke('state'), tab: invoke('tab'), collect: invoke('collect'), rescan: invoke('rescan'), auto: invoke('auto'),
  accountLogin: invoke('account-login'), accountLogout: invoke('account-logout'), accountRefresh: invoke('account-refresh'),
  accountMatch: invoke('account-match'),
  editProfile: invoke('edit-profile'), forgotPassword: invoke('forgot-password'), appFolder: invoke('app-folder'),
  retry: invoke('retry'), match: invoke('match'), folder: invoke('folder'), browserHub: invoke('browser-hub'),
  previewMatch: invoke('preview-match'),
  reportingConnect: invoke('reporting-connect'), reportingDisconnect: invoke('reporting-disconnect'), onReporting: subscribe('reporting-state'),
  openLink: invoke('open-link'), setLanguage: invoke('language'), publicRefresh: invoke('public-refresh'),
  updateCheck: invoke('update-check'), updateDownload: invoke('update-download'), updateInstall: invoke('update-install'),
  hide: invoke('hide'), quit: invoke('quit'),
  onState: subscribe('collector-state'), onPublic: subscribe('public-state'), onUpdates: subscribe('update-state'),
  onAccount: subscribe('account-state'),
});
