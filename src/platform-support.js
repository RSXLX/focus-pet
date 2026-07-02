const WINDOWS_PRIVACY_SETTINGS = 'ms-settings:privacy';

function normalizePlatform(platform = process.platform) {
  if (platform === 'darwin' || platform === 'win32' || platform === 'linux') return platform;
  return 'unknown';
}

function platformName(platform = process.platform) {
  const key = normalizePlatform(platform);
  if (key === 'darwin') return 'macOS';
  if (key === 'win32') return 'Windows';
  if (key === 'linux') return 'Linux';
  return '当前系统';
}

function platformFocusPermission(platform = process.platform) {
  const key = normalizePlatform(platform);
  if (key === 'win32') {
    return {
      reason: 'Windows 前台窗口读取失败',
      message: '我还看不到当前窗口。请确认 Focus Pet 正在桌面运行；如果 Windows 安全策略拦截了前台窗口读取，请允许 Focus Pet 或 PowerShell。'
    };
  }
  if (key === 'darwin') {
    return {
      reason: 'macOS 辅助功能权限不足',
      message: '我还看不到当前窗口。请到 系统设置 → 隐私与安全性 → 辅助功能，允许 Focus Pet / Electron / Terminal。'
    };
  }
  return {
    reason: `${platformName(key)} 前台窗口读取暂不可用`,
    message: `我还看不到当前窗口。${platformName(key)} 版本暂未接入前台窗口读取，只能继续使用任务和聊天功能。`
  };
}

function platformSettingsProfile(platform = process.platform) {
  const key = normalizePlatform(platform);
  if (key === 'win32') {
    return {
      platform: key,
      name: 'Windows',
      accessibilityButtonLabel: '隐私设置',
      screenRecordingButtonLabel: '屏幕权限',
      screenRecordingSettingsAvailable: false,
      permissionHelpText: 'Windows 版会用系统前台窗口标题判断专注状态；如果被安全策略拦截，请在 Windows 隐私或安全设置中允许 Focus Pet / PowerShell。',
      screenMonitorHelpText: 'Windows 版屏幕监控通过 Electron 截屏能力工作，没有单独的“屏幕录制”设置入口。',
      permissionGuideTitle: '权限引导',
      permissionGuideSteps: [
        {
          id: 'accessibility',
          title: '隐私与安全策略',
          summary: '如果前台窗口读取被拦截，请允许 Focus Pet 或 PowerShell 读取当前窗口标题。',
          settingsKind: 'accessibility',
          buttonLabel: '打开隐私设置'
        }
      ]
    };
  }
  if (key === 'darwin') {
    return {
      platform: key,
      name: 'macOS',
      accessibilityButtonLabel: '权限',
      screenRecordingButtonLabel: '屏幕权限',
      screenRecordingSettingsAvailable: true,
      permissionHelpText: 'macOS 需要辅助功能权限读取当前 App 和窗口标题。',
      screenMonitorHelpText: '开启屏幕监控前，需要在 macOS 隐私设置里允许屏幕录制。',
      permissionGuideTitle: '权限引导',
      permissionGuideSteps: [
        {
          id: 'accessibility',
          title: '辅助功能',
          summary: '允许 Focus Pet / Electron / Terminal 读取当前 App 和窗口标题，用于判断专注状态。',
          settingsKind: 'accessibility',
          buttonLabel: '打开辅助功能'
        },
        {
          id: 'screen-recording',
          title: '屏幕录制',
          summary: '开启屏幕监控和 LLM 截图分析前，需要允许屏幕录制权限。',
          settingsKind: 'screen-recording',
          buttonLabel: '打开屏幕录制'
        }
      ]
    };
  }
  return {
    platform: key,
    name: platformName(key),
    accessibilityButtonLabel: '隐私设置',
    screenRecordingButtonLabel: '屏幕权限',
    screenRecordingSettingsAvailable: false,
    permissionHelpText: `${platformName(key)} 版本暂未接入前台窗口读取。`,
    screenMonitorHelpText: `${platformName(key)} 版本暂未提供独立屏幕权限入口。`,
    permissionGuideTitle: '权限引导',
    permissionGuideSteps: [
      {
        id: 'accessibility',
        title: '系统能力',
        summary: `${platformName(key)} 版本暂未提供自动授权入口，请按系统提示授予需要的窗口或屏幕能力。`,
        settingsKind: '',
        buttonLabel: ''
      }
    ]
  };
}

function platformSettingsTarget(kind, platform = process.platform) {
  const key = normalizePlatform(platform);
  if (key === 'darwin') {
    if (kind === 'screen-recording') {
      return {
        kind: 'external',
        url: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      };
    }
    return {
      kind: 'external',
      url: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    };
  }
  if (key === 'win32') {
    return {
      kind: 'external',
      url: WINDOWS_PRIVACY_SETTINGS
    };
  }
  return null;
}

function windowsFrontmostScript() {
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FocusPetWin32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$handle = [FocusPetWin32]::GetForegroundWindow()
$title = New-Object System.Text.StringBuilder 1024
[void][FocusPetWin32]::GetWindowText($handle, $title, $title.Capacity)
$processId = 0
[void][FocusPetWin32]::GetWindowThreadProcessId($handle, [ref]$processId)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
[pscustomobject]@{
  app = if ($process) { $process.ProcessName } else { "" }
  title = $title.ToString()
} | ConvertTo-Json -Compress
`.trim();
}

function parseWindowsFrontmost(raw) {
  const payload = JSON.parse(String(raw || '').trim() || '{}');
  return {
    app: String(payload.app || payload.processName || '').trim() || '未知',
    title: String(payload.title || '').trim()
  };
}

module.exports = {
  normalizePlatform,
  parseWindowsFrontmost,
  platformFocusPermission,
  platformName,
  platformSettingsProfile,
  platformSettingsTarget,
  windowsFrontmostScript
};
