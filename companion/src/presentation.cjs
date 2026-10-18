const positions = {
  TOP: ['top', 'Top'], TOP_LANE: ['top', 'Top'],
  JNG: ['jungle', 'Jungle'], JGL: ['jungle', 'Jungle'], JUNGLE: ['jungle', 'Jungle'],
  MID: ['mid', 'Middle'], MIDDLE: ['mid', 'Middle'], MID_LANE: ['mid', 'Middle'],
  ADC: ['bot', 'Bottom'], BOT: ['bot', 'Bottom'], BOTTOM: ['bot', 'Bottom'], BOTTOM_LANE: ['bot', 'Bottom'],
  SUP: ['support', 'Support'], SUPP: ['support', 'Support'], SUPPORT: ['support', 'Support'], UTILITY: ['support', 'Support'],
  FILL: ['fill', 'Fill'],
};
function position(value) { return positions[String(value || '').trim().toUpperCase()] || null; }
const tiers = [
  ['\u6700\u5f3a\u738b\u8005', 'Challenger'], ['\u50b2\u4e16\u5b97\u5e08', 'Grandmaster'], ['\u8d85\u51e1\u5927\u5e08', 'Master'],
  ['\u575a\u97e7\u9ed1\u94c1', 'Iron'], ['\u82f1\u52c7\u9ec4\u94dc', 'Bronze'], ['\u4e0d\u5c48\u767d\u94f6', 'Silver'],
  ['\u8363\u8000\u9ec4\u91d1', 'Gold'], ['\u534e\u8d35\u94c2\u91d1', 'Platinum'], ['\u6d41\u5149\u7fe1\u7fe0', 'Emerald'], ['\u7480\u74a8\u94bb\u77f3', 'Diamond'],
  ['\u9ed1\u94c1', 'Iron'], ['\u9752\u94dc', 'Bronze'], ['\u9ec4\u94dc', 'Bronze'], ['\u767d\u94f6', 'Silver'], ['\u9ec4\u91d1', 'Gold'],
  ['\u94c2\u91d1', 'Platinum'], ['\u7fe1\u7fe0', 'Emerald'], ['\u94bb\u77f3', 'Diamond'], ['\u5b97\u5e08', 'Grandmaster'], ['\u5927\u5e08', 'Master'], ['\u738b\u8005', 'Challenger'],
];
function rankLabel(value, chinese = false) {
  const source = String(value || '').trim();
  if (!source) return '';
  if (chinese) return source;
  if (/^(?:-|\u65e0\u6bb5\u4f4d|\u672a\u5b9a\u7ea7|\u672a\u6392\u4f4d)$/.test(source)) return 'Unranked';
  for (const [zh, en] of tiers) if (source.startsWith(zh)) {
    const division = source.slice(zh.length).trim().replace(/[\u2160-\u2163]/g, c => ['I', 'II', 'III', 'IV'][c.charCodeAt(0) - 0x2160]);
    return `${en}${division ? ` ${division}` : ''}`;
  }
  return source;
}
function serverLabel(value, servers, chinese = false) {
  const source = String(value || '').trim();
  const found = servers.find(s => s.chineseName === source || s.name.toLowerCase() === source.toLowerCase());
  return found ? chinese ? found.chineseName : found.name : source;
}
function updateLabel(status) {
  return ({ idle: 'Not checked yet', checking: 'Checking...', current: 'Up to date', available: 'Update available', downloading: 'Downloading {{percent}}%', ready: 'Restart to update', unavailable: 'Check unavailable', invalid: 'Update rejected', development: 'Local review build' })[status] || 'Check unavailable';
}
function reportStage(gameId, reporting) {
  if (reporting?.job?.gameId !== gameId) return 'Local copy';
  return ({ collecting: 'Preparing upload', uploading: 'Uploading', retry: 'Retry pending', review: 'Awaiting admin review' })[reporting.status] || 'Local copy';
}
module.exports = { position, rankLabel, serverLabel, updateLabel, reportStage };
