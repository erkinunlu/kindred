// app.config.js - EXPO_IOS_DEVELOPMENT_TEAM ile iOS imza yapılandırması
const appJson = require('./app.json');

module.exports = () => {
  const expo = { ...appJson.expo };
  const teamId = process.env.EXPO_IOS_DEVELOPMENT_TEAM;
  if (teamId && expo.ios) {
    expo.ios = { ...expo.ios, developmentTeam: teamId };
  }
  if (!expo.plugins) expo.plugins = [];
  if (!expo.plugins.some((p) => (Array.isArray(p) ? p[0] : p) === 'expo-notifications')) {
    expo.plugins.push(['expo-notifications', { icon: './assets/icon.png', color: '#E74C3C' }]);
  }
  return { expo };
};
