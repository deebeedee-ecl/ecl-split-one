import i18next from 'i18next';
import { zh } from './zh.js';
i18next.init({ lng: 'en', fallbackLng: 'en', initImmediate: false, keySeparator: false, nsSeparator: false, resources: { 'zh-CN': { translation: zh } }, interpolation: { escapeValue: true } });
export const t = (key, values = {}) => i18next.t(key, values);
export const locale = () => i18next.language === 'zh-CN' ? 'zh-CN' : 'en-GB';
// Capture only the original static document. User names and remote posts are never translated.
const staticNodes = [], attributes = [];
const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walk.nextNode()) {
  const node = walk.currentNode, key = node.textContent.trim();
  if (key && !node.parentElement.closest('script,style')) staticNodes.push({ node, key, prefix: node.textContent.match(/^\s*/)[0], suffix: node.textContent.match(/\s*$/)[0] });
}
for (const element of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
  for (const attr of ['title', 'aria-label', 'placeholder']) if (element.hasAttribute(attr)) attributes.push({ element, attr, key: element.getAttribute(attr) });
}
export async function setLanguage(language) {
  await i18next.changeLanguage(language === 'zh-CN' ? 'zh-CN' : 'en');
  document.documentElement.lang = i18next.language;
  for (const { node, key, prefix, suffix } of staticNodes) if (node.isConnected) node.textContent = `${prefix}${t(key)}${suffix}`;
  for (const { element, attr, key } of attributes) if (element.isConnected) element.setAttribute(attr, t(key));
}
