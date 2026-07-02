const DEV_LAUNCH_AT_LOGIN_REASON = '开发模式下不会写入系统登录项；打包后可启用。';

function launchAtLoginSupported(appLike, env = process.env) {
  return Boolean(appLike?.isPackaged) || env.FOCUS_PET_ENABLE_DEV_LOGIN_ITEM === '1';
}

function appIsReady(appLike) {
  return typeof appLike?.isReady === 'function' ? appLike.isReady() : true;
}

function readLoginItemSettings(appLike) {
  if (typeof appLike?.getLoginItemSettings !== 'function') return {};
  try {
    return appLike.getLoginItemSettings() || {};
  } catch {
    return {};
  }
}

function launchAtLoginState(appLike, settings = {}, options = {}) {
  const requested = Boolean(settings.launchAtLogin);
  const supported = launchAtLoginSupported(appLike, options.env);
  if (!appIsReady(appLike)) {
    return {
      launchAtLogin: requested,
      launchAtLoginRequested: requested,
      launchAtLoginActive: false,
      launchAtLoginSupported: supported,
      launchAtLoginReason: '应用尚未初始化。'
    };
  }
  if (!supported) {
    return {
      launchAtLogin: requested,
      launchAtLoginRequested: requested,
      launchAtLoginActive: false,
      launchAtLoginSupported: false,
      launchAtLoginReason: DEV_LAUNCH_AT_LOGIN_REASON
    };
  }
  const loginItem = readLoginItemSettings(appLike);
  return {
    launchAtLogin: requested,
    launchAtLoginRequested: requested,
    launchAtLoginActive: Boolean(loginItem.openAtLogin),
    launchAtLoginSupported: true,
    launchAtLoginReason: ''
  };
}

function applyLaunchAtLogin(appLike, settings = {}, options = {}) {
  const baseState = launchAtLoginState(appLike, settings, options);
  if (!baseState.launchAtLoginSupported || !appIsReady(appLike)) {
    return { ...baseState, launchAtLoginApplied: false };
  }
  try {
    appLike.setLoginItemSettings({
      openAtLogin: Boolean(settings.launchAtLogin),
      openAsHidden: true,
      path: options.path || process.execPath
    });
    return {
      ...launchAtLoginState(appLike, settings, options),
      launchAtLoginApplied: true
    };
  } catch (error) {
    return {
      ...baseState,
      launchAtLoginApplied: false,
      launchAtLoginReason: `设置开机启动失败：${error.message}`
    };
  }
}

module.exports = {
  DEV_LAUNCH_AT_LOGIN_REASON,
  applyLaunchAtLogin,
  launchAtLoginState,
  launchAtLoginSupported
};
