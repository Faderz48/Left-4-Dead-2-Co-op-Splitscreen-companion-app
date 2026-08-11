const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const {
  OFFICIAL_MAPS, BUTTONS, ACTIONS, defaultSettings, normalizeSettings,
  generateControllerConfig, generateSessionConfig, parseLibraryFolders,
  validGamePath, scanAddonMaps
} = require('./l4d2');

if (process.platform === 'linux') {
  // This utility does not need GPU acceleration. Software composition avoids
  // blank Electron windows on older Mesa, NVIDIA/Wayland, and Steam Deck setups.
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-features', 'Vulkan');
}

if (process.platform === 'linux' && process.env.L4D2_LAUNCHER_NO_SANDBOX === '1') {
  // Opt-in fallback for distributions that disable unprivileged user namespaces.
  app.commandLine.appendSwitch('no-sandbox');
}

let mainWindow;
let rendererReady = false;

function diagnosticLog(message) {
  try {
    const line = `${new Date().toISOString()} ${message}\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'launcher.log'), line);
  } catch { /* Diagnostics must never prevent startup. */ }
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function settingsFile() { return path.join(app.getPath('userData'), 'settings.json'); }

function registryValue(key, name) {
  if (process.platform !== 'win32') return '';
  try {
    const output = execFileSync('reg.exe', ['query', key, '/v', name], { encoding: 'utf8', windowsHide: true });
    const match = output.match(new RegExp(`${name}\\s+REG_\\w+\\s+(.+)$`, 'mi'));
    return match?.[1]?.trim() || '';
  } catch { return ''; }
}

function steamRoots() {
  const roots = [];
  if (process.platform === 'win32') {
    roots.push(
      registryValue('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
      registryValue('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
      process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Steam'),
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Steam')
    );
  } else {
    roots.push(
      process.env.STEAM_COMPAT_CLIENT_INSTALL_PATH,
      path.join(os.homedir(), '.steam', 'steam'),
      path.join(os.homedir(), '.local', 'share', 'Steam'),
      path.join(os.homedir(), '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam')
    );
  }
  return [...new Set(roots.filter((root) => root && fs.existsSync(root)).map((root) => path.resolve(root)))];
}

function libraryRoots() {
  const libraries = [];
  for (const root of steamRoots()) {
    libraries.push(root);
    try {
      const text = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      libraries.push(...parseLibraryFolders(text));
    } catch { /* default library is still usable */ }
  }
  return [...new Set(libraries.map((root) => path.resolve(root)))];
}

function detectGamePath(savedPath = '') {
  if (validGamePath(savedPath)) return savedPath;
  if (process.platform === 'win32') {
    const installed = registryValue('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 550', 'InstallLocation') ||
      registryValue('HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 550', 'InstallLocation');
    if (validGamePath(installed)) return installed;
  }
  for (const library of libraryRoots()) {
    const candidate = path.join(library, 'steamapps', 'common', 'Left 4 Dead 2');
    if (validGamePath(candidate)) return candidate;
  }
  return '';
}

function steamCommand() {
  if (process.platform === 'win32') {
    for (const root of steamRoots()) {
      const executable = path.join(root, 'steam.exe');
      if (fs.existsSync(executable)) return { executable, prefix: [] };
    }
  } else {
    for (const executable of ['/usr/bin/steam', '/usr/local/bin/steam', path.join(os.homedir(), '.steam', 'steam', 'steam.sh')]) {
      if (fs.existsSync(executable)) return { executable, prefix: [] };
    }
    if (fs.existsSync(path.join(os.homedir(), '.var', 'app', 'com.valvesoftware.Steam'))) {
      return { executable: 'flatpak', prefix: ['run', 'com.valvesoftware.Steam'] };
    }
  }
  throw new Error('Steam could not be found. Start Steam and try again.');
}

function gameRunning() {
  try {
    if (process.platform === 'win32') {
      return /left4dead2\.exe/i.test(execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq left4dead2.exe'], { encoding: 'utf8', windowsHide: true }));
    }
    return fs.readdirSync('/proc').some((name) => {
      if (!/^\d+$/.test(name)) return false;
      try { return fs.readFileSync(`/proc/${name}/comm`, 'utf8').trim().toLowerCase().startsWith('left4dead2'); } catch { return false; }
    });
  } catch { return false; }
}

function writeSession(settings) {
  if (!validGamePath(settings.gamePath)) throw new Error('Select a valid Left 4 Dead 2 installation.');
  const cfg = path.join(settings.gamePath, 'left4dead2', 'cfg');
  fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, 'modern_ss_controllers.cfg'), generateControllerConfig(settings), 'ascii');
  fs.writeFileSync(path.join(cfg, 'modern_ss_session.cfg'), generateSessionConfig(settings), 'ascii');
}

function createWindow() {
  rendererReady = false;
  const launchSettings = normalizeSettings(readJson(settingsFile(), defaultSettings()));
  mainWindow = new BrowserWindow({
    width: 1120, height: 780, minWidth: 900, minHeight: 680,
    fullscreen: launchSettings.bigPictureMode,
    backgroundColor: '#101318', title: 'L4D2 Native Split Screen',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, backgroundThrottling: false
    }
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch((error) => {
    diagnosticLog(`loadFile failed: ${error.stack || error}`);
    dialog.showErrorBox('Launcher interface could not load', `The diagnostic log is in:\n${path.join(app.getPath('userData'), 'launcher.log')}`);
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    diagnosticLog(`renderer stopped: ${JSON.stringify(details)}`);
    dialog.showErrorBox('Launcher renderer stopped', `Reason: ${details.reason}\n\nDiagnostic log:\n${path.join(app.getPath('userData'), 'launcher.log')}`);
  });
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) diagnosticLog(`renderer console level=${level} ${sourceId}:${line} ${message}`);
  });
  setTimeout(() => {
    if (!rendererReady && mainWindow && !mainWindow.isDestroyed()) {
      diagnosticLog('renderer-ready handshake timed out');
      dialog.showMessageBox(mainWindow, {
        type: 'warning', title: 'Launcher display problem',
        message: 'The interface did not finish loading.',
        detail: `Please send us this diagnostic log:\n${path.join(app.getPath('userData'), 'launcher.log')}`
      });
    }
  }, 12000);
}

app.whenReady().then(() => {
  diagnosticLog(`starting version=${app.getVersion()} platform=${process.platform} arch=${process.arch} display=${process.env.XDG_SESSION_TYPE || 'unknown'}`);
  ipcMain.on('renderer-ready', () => { rendererReady = true; diagnosticLog('renderer ready'); });
  ipcMain.on('quit-app', () => app.quit());
  ipcMain.handle('initial-state', () => {
    const stored = normalizeSettings(readJson(settingsFile(), defaultSettings()));
    stored.gamePath = detectGamePath(stored.gamePath);
    return { settings: stored, platform: process.platform, maps: OFFICIAL_MAPS, buttons: BUTTONS, actions: Object.keys(ACTIONS) };
  });
  ipcMain.handle('choose-game', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Select the Left 4 Dead 2 folder' });
    if (result.canceled) return '';
    if (!validGamePath(result.filePaths[0])) throw new Error('That folder does not contain this platform’s L4D2 installation.');
    return result.filePaths[0];
  });
  ipcMain.handle('scan-maps', (_event, gamePath) => {
    if (!validGamePath(gamePath)) throw new Error('Select a valid L4D2 installation first.');
    return scanAddonMaps(gamePath);
  });
  ipcMain.handle('save-settings', (_event, raw) => {
    const settings = normalizeSettings(raw);
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
    return settings;
  });
  ipcMain.handle('set-fullscreen', (_event, enabled) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setFullScreen(Boolean(enabled));
    return mainWindow?.isFullScreen() || false;
  });
  ipcMain.handle('launch-session', async (_event, raw) => {
    const settings = normalizeSettings(raw);
    if (gameRunning()) throw new Error('Close Left 4 Dead 2 before starting a new split-screen session.');
    writeSession(settings);
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
    const steam = steamCommand();
    const args = [...steam.prefix, '-applaunch', '550', '-novid', '+exec', 'modern_ss_session.cfg'];
    const child = spawn(steam.executable, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return { ok: true };
  });
  ipcMain.handle('open-controls-help', () => shell.openExternal('https://help.steampowered.com/'));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
