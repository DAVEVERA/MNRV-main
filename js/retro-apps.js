/* MNRV retro desktop applications — intentionally dependency-free. */
(function() {
  'use strict';

  var ICONS = 'assets/icons/';
  var STORAGE = {
    note: 'mnrv95.notepad',
    display: 'mnrv95.display',
    recycle: 'mnrv95.recycle',
    deleted: 'mnrv95.deleted',
    dialup: 'mnrv95.dialup'
  };
  var projectFiles = [
    { name: 'MNRV_LEESMIJ.TXT', icon: 'w98_NotepadFile_32x32_4.png', type: 'Tekstdocument', size: '2 kB' },
    { name: 'oude-campagne.BMP', icon: 'w98_Paint_32x32_4.png', type: 'Bitmapafbeelding', size: '48 kB' },
    { name: 'robot-concept.ICO', icon: 'w98_SettingsGear_32x32_4.png', type: 'Pictogram', size: '12 kB' }
  ];
  var recycledFiles = readJson(STORAGE.recycle, []);
  var deletedFiles = readJson(STORAGE.deleted, []);

  function readJson(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function windowButtons(mode) {
    var controls = '';
    if (mode === 'help-close') {
      controls += '<button class="win-titlebar-btn help-btn" type="button" aria-label="Contextuele Help" title="Contextuele Help" aria-expanded="false">?</button>';
    } else if (mode !== 'close-only') {
      controls += '<button class="win-titlebar-btn min-btn" type="button" aria-label="Minimaliseren" title="Minimaliseren">_</button>' +
        '<button class="win-titlebar-btn max-btn" type="button" aria-label="Maximaliseren" title="Maximaliseren">&#9633;</button>';
    }
    controls += '<button class="win-titlebar-btn close-btn" type="button" aria-label="Sluiten" title="Sluiten">X</button>';
    return '<div class="win-titlebar-buttons">' + controls + '</div>';
  }

  function titlebar(title, icon, controls) {
    return '<div class="win-titlebar">' +
      (icon ? '<img class="win-titlebar-icon" src="' + ICONS + icon + '" alt="" draggable="false">' : '') +
      '<span class="win-titlebar-title">' + title + '</span>' + windowButtons(controls) + '</div>';
  }

  function desktopIcon(label, target, icon, id) {
    return '<div class="desktop-icon retro-app-icon" tabindex="0" role="button" data-window="' + target + '"' +
      (id ? ' id="' + id + '"' : '') + '>' +
      '<img class="icon-img" src="' + ICONS + icon + '" alt="" draggable="false">' +
      '<span class="icon-label">' + label + '</span></div>';
  }

  function injectDesktopIcons() {
    var container = document.querySelector('.desktop-icons');
    if (!container || document.getElementById('retro-computer-icon')) return;
    container.insertAdjacentHTML('afterbegin',
      desktopIcon('Deze computer', 'computer-window', 'w98_Computer_32x32_4.png', 'retro-computer-icon') +
      desktopIcon('Configuratie\u00adscherm', 'control-panel-window', 'w98_DirectoryControlPanel_32x32_4.png', 'retro-control-icon') +
      desktopIcon('Prullenbak', 'recycle-window', 'w98_RecycleBinEmpty_32x32_4.png', 'recycle-desktop-icon') +
      desktopIcon('Kladblok', 'notepad-window', 'w98_Notepad_32x32_4.png', 'retro-notepad-icon') +
      desktopIcon('Paint', 'paint-window', 'w98_Paint_32x32_4.png', 'retro-paint-icon') +
      desktopIcon('Inbelverbinding', 'dialup-window', 'w98_Network_32x32_4.png', 'retro-dialup-icon')
    );
  }

  function injectStartMenuItems() {
    var items = document.querySelector('.start-menu-items');
    var shutdown = document.getElementById('start-shutdown');
    if (!items || !shutdown || document.getElementById('start-run')) return;
    var separator = shutdown.previousElementSibling;
    separator.insertAdjacentHTML('beforebegin',
      '<div class="start-menu-item" data-open-window="computer-window" tabindex="0">' +
        '<img src="' + ICONS + 'w98_Computer_16x16_4.png" alt=""><span>Deze computer</span></div>' +
      '<div class="start-menu-item" data-open-window="control-panel-window" tabindex="0">' +
        '<img src="' + ICONS + 'w98_DirectoryControlPanel_16x16_4.png" alt=""><span>Configuratiescherm</span></div>' +
      '<div class="start-menu-item" id="start-run" data-open-window="run-window" tabindex="0">' +
        '<img src="' + ICONS + 'w98_MsDos_16x16_4.png" alt=""><span>Uitvoeren...</span></div>'
    );
  }

  function injectWindows() {
    var desktop = document.querySelector('.desktop');
    if (!desktop || document.getElementById('computer-window')) return;
    desktop.insertAdjacentHTML('beforeend', `
      <section id="computer-window" class="win-window hidden retro-app-window computer-window" aria-label="Deze computer">
        ${titlebar('Deze computer', 'w98_Computer_16x16_4.png')}
        <div class="win-menubar retro-real-menu" role="menubar">
          <button type="button">Bestand</button><button type="button">Bewerken</button><button type="button">Beeld</button><button type="button">Help</button>
        </div>
        <div class="retro-explorer-toolbar">
          <button class="win-btn btn-sm" type="button" id="explorer-up" disabled>Omhoog</button>
          <label for="explorer-address">Adres:</label><input id="explorer-address" class="win-input" readonly value="Deze computer">
        </div>
        <div class="win-body retro-explorer-body">
          <div class="retro-explorer-grid" id="explorer-grid" aria-live="polite"></div>
        </div>
        <div class="win-statusbar"><span class="win-statusbar-section" id="explorer-status">6 object(en)</span><span class="win-statusbar-section">Deze computer</span></div>
      </section>

      <section id="control-panel-window" class="win-window hidden retro-app-window control-panel-window" aria-label="Configuratiescherm">
        ${titlebar('Configuratiescherm', 'w98_DirectoryControlPanel_16x16_4.png')}
        <div class="win-menubar retro-real-menu" role="menubar"><button type="button">Bestand</button><button type="button">Bewerken</button><button type="button">Beeld</button><button type="button">Help</button></div>
        <div class="win-body control-panel-body">
          <div class="control-icon-list" aria-label="Onderdelen van Configuratiescherm">
            <button class="control-icon selected" type="button"><img src="${ICONS}w98_display_properties.ico" alt=""><span>Beeldscherm</span></button>
            <button class="control-icon" type="button" disabled><img src="${ICONS}w98_SettingsGear_32x32_4.png" alt=""><span>Systeem</span></button>
            <button class="control-icon" type="button" disabled><img src="${ICONS}w98_Network_32x32_4.png" alt=""><span>Netwerk</span></button>
          </div>
          <form id="display-properties" class="display-properties">
            <h2>Eigenschappen voor Beeldscherm</h2>
            <div class="display-preview"><div id="display-preview-screen"><span>MNRV 95</span></div></div>
            <div class="property-tabs" role="tablist" aria-label="Beeldscherminstellingen">
              <button type="button" class="active">Achtergrond</button><button type="button">Vormgeving</button><button type="button">Instellingen</button>
            </div>
            <div class="display-fields">
              <label>Bureaubladkleur
                <select id="desktop-color" class="win-input">
                  <option value="#008080">Windows-teal</option><option value="#000080">Marineblauw</option><option value="#35654d">Bosgroen</option><option value="#6b3d66">Pruim</option>
                </select>
              </label>
              <label>Patroon
                <select id="desktop-pattern" class="win-input"><option value="none">Geen</option><option value="dots">Puntjes</option><option value="checker">Dambord</option></select>
              </label>
              <label>Kleurenschema
                <select id="window-scheme" class="win-input"><option value="classic">Windows-standaard</option><option value="plum">Pruim</option><option value="forest">Bosgroen</option></select>
              </label>
              <label>Schermgebied (simulatie)
                <select id="desktop-resolution" class="win-input"><option value="640">640 bij 480 pixels</option><option value="800" selected>800 bij 600 pixels</option><option value="1024">1024 bij 768 pixels</option></select>
              </label>
            </div>
            <div class="retro-dialog-actions"><button class="win-btn" type="submit">OK</button><button class="win-btn" type="button" id="display-apply">Toepassen</button><button class="win-btn" type="button" id="display-reset">Standaard</button></div>
          </form>
        </div>
        <div class="win-statusbar"><span class="win-statusbar-section">Dubbelklik op een pictogram om instellingen te wijzigen.</span></div>
      </section>

      <section id="recycle-window" class="win-window hidden retro-app-window recycle-window" aria-label="Prullenbak">
        ${titlebar('Prullenbak', 'w98_RecycleBinEmpty_16x16_4.png')}
        <div class="win-menubar retro-real-menu" role="menubar"><button type="button">Bestand</button><button type="button">Bewerken</button><button type="button">Beeld</button><button type="button">Help</button></div>
        <div class="recycle-toolbar"><button class="win-btn btn-sm" id="recycle-restore" type="button">Terugzetten</button><button class="win-btn btn-sm" id="recycle-empty" type="button">Prullenbak leegmaken</button></div>
        <div class="win-body recycle-drop-zone" id="recycle-drop-zone"><div id="recycle-list" class="recycle-list" role="listbox" aria-label="Verwijderde bestanden"></div></div>
        <div class="win-statusbar"><span class="win-statusbar-section" id="recycle-status">De Prullenbak is leeg.</span></div>
      </section>

      <section id="notepad-window" class="win-window hidden retro-app-window notepad-window" aria-label="Kladblok">
        ${titlebar('Naamloos - Kladblok', 'w98_Notepad_16x16_4.png')}
        <div class="win-menubar retro-real-menu" role="menubar">
          <button id="notepad-new" type="button"><u>B</u>estand</button><button type="button"><u>B</u>ewerken</button><button type="button"><u>Z</u>oeken</button><button type="button"><u>H</u>elp</button>
        </div>
        <div class="win-body notepad-body"><label class="sr-only" for="notepad-text">Notitie</label><textarea id="notepad-text" spellcheck="false">Welkom bij MNRV 95.\n\nSchrijf hier je ideeën. Ze worden alleen lokaal in deze browser bewaard.</textarea></div>
        <div class="notepad-footer"><span id="notepad-status">Gereed</span><button class="win-btn btn-sm" id="notepad-save" type="button">Opslaan</button></div>
      </section>

      <section id="paint-window" class="win-window hidden retro-app-window paint-window" aria-label="Paint">
        ${titlebar('Naamloos - Paint', 'w98_Paint_16x16_4.png')}
        <div class="win-menubar retro-real-menu" role="menubar"><button type="button">Bestand</button><button type="button">Bewerken</button><button type="button">Beeld</button><button type="button">Afbeelding</button><button type="button">Help</button></div>
        <div class="paint-toolbar" aria-label="Tekengereedschap">
          <button class="win-btn paint-tool active" type="button" data-paint-tool="brush" aria-pressed="true">Potlood</button>
          <button class="win-btn paint-tool" type="button" data-paint-tool="eraser" aria-pressed="false">Gum</button>
          <label>Dikte <select id="paint-size" class="win-input"><option>2</option><option selected>5</option><option>10</option><option>18</option></select></label>
          <label>Kleur <input id="paint-color" type="color" value="#000000"></label>
          <button class="win-btn" id="paint-clear" type="button">Wissen</button><button class="win-btn" id="paint-download" type="button">Opslaan als PNG</button>
        </div>
        <div class="win-body paint-body"><canvas id="paint-canvas" width="900" height="500" aria-label="Paint-tekenvel"></canvas></div>
        <div class="win-statusbar"><span class="win-statusbar-section" id="paint-status">Sleep over het tekenvel om te tekenen.</span><span class="win-statusbar-section">900 x 500</span></div>
      </section>

      <section id="dialup-window" class="win-window hidden retro-app-window dialup-window" aria-label="Inbelverbinding" data-context-help="Vul uw inbelgegevens in en klik op Verbinden om de gesimuleerde MNRV Net-verbinding tot stand te brengen.">
        ${titlebar('Verbinding maken met MNRV Net', '', 'help-close')}
        <div class="win-body dialup-body">
          <div class="dialup-heading"><img src="${ICONS}w98_Network_32x32_4.png" alt=""><p>Typ uw gebruikersnaam en wachtwoord en klik vervolgens op Verbinden.</p></div>
          <label>Gebruikersnaam:<input id="dialup-user" class="win-input" value="bezoeker"></label>
          <label>Wachtwoord:<input id="dialup-password" class="win-input" type="password" value="mnrv95"></label>
          <label>Telefoonnummer:<input class="win-input" value="06-95-MNRV-NET" readonly></label>
          <label class="dialup-remember"><input type="checkbox" checked> Wachtwoord opslaan</label>
          <div class="dialup-progress" aria-hidden="true"><span id="dialup-progress-bar"></span></div>
          <p id="dialup-status" role="status">Niet verbonden.</p>
        </div>
        <div class="retro-dialog-actions dialup-actions"><button class="win-btn win-btn-default" id="dialup-connect" type="button">Verbinden</button><button class="win-btn close-dialog-button" type="button">Annuleren</button></div>
      </section>

      <section id="run-window" class="win-window win-dialog hidden run-window" data-no-taskbar="true" aria-label="Uitvoeren" data-context-help="Typ de naam van een programma, map of document dat u wilt openen.">
        ${titlebar('Uitvoeren', '', 'help-close')}
        <form id="run-form" class="run-dialog-body">
          <img src="${ICONS}w98_MsDos_32x32_4.png" alt="">
          <p>Typ de naam van een programma, map, document of Internet-bron. Windows zal het programma voor u openen.</p>
          <label>Openen:<input id="run-command" class="win-input" autocomplete="off" value=""></label>
          <p class="run-hint">Probeer: notepad, mspaint, calc, command, winver of mnrv</p>
          <p id="run-status" role="status"></p>
          <div class="retro-dialog-actions"><button class="win-btn win-btn-default" type="submit">OK</button><button class="win-btn close-dialog-button" type="button">Annuleren</button></div>
        </form>
      </section>

      <section id="calculator-window" class="win-window hidden retro-app-window calculator-window" aria-label="Rekenmachine">
        ${titlebar('Rekenmachine', 'w98_Calculator_16x16_4.png')}
        <div class="win-menubar retro-real-menu"><button type="button">Bewerken</button><button type="button">Beeld</button><button type="button">Help</button></div>
        <div class="calculator-body"><output id="calculator-display">0</output><div id="calculator-keys" class="calculator-keys"></div></div>
      </section>

      <section id="command-window" class="win-window hidden retro-app-window command-window" aria-label="MS-DOS-prompt">
        ${titlebar('MS-DOS-prompt', 'w98_MsDos_16x16_4.png')}
        <div class="command-screen" id="command-screen" tabindex="0"><p>Microsoft(R) Windows 95</p><p>(C)Copyright Microsoft Corp 1981-1995.</p><p>&nbsp;</p><p>C:\\MNRV&gt; <span class="command-caret">_</span></p></div>
      </section>

      <section id="winver-window" class="win-window win-dialog hidden winver-window" data-no-taskbar="true" aria-label="Info over MNRV 95">
        ${titlebar('Info over MNRV 95', '', 'close-only')}
        <div class="winver-body"><img src="assets/img/MNRV_LOGO.png" alt="MNRV"><div><h2>Microsoft MNRV 95</h2><p>Versie 4.00.950 MNRV</p><p>Deze retro-omgeving is geregistreerd op naam van:</p><p><strong>Bezoeker van MNRV</strong></p><p>64.0 MB RAM</p></div></div>
        <div class="retro-dialog-actions"><button class="win-btn win-btn-default close-dialog-button" type="button">OK</button></div>
      </section>

      <section id="recycle-confirm-dialog" class="win-window win-dialog hidden recycle-confirm-dialog" data-no-taskbar="true" aria-label="Verwijderen bevestigen">
        ${titlebar('Verwijderen bevestigen', '', 'close-only')}
        <div class="confirm-body"><span class="confirm-icon">!</span><p>Weet u zeker dat u deze items permanent wilt verwijderen?</p></div>
        <div class="retro-dialog-actions"><button class="win-btn win-btn-default" id="recycle-confirm-yes" type="button">Ja</button><button class="win-btn close-dialog-button" type="button">Nee</button></div>
      </section>
    `);
  }

  function showWindow(id) {
    if (window.MNRV && typeof window.MNRV.showWindow === 'function') {
      window.MNRV.showWindow(id);
      return;
    }
    var win = document.getElementById(id);
    if (win) win.classList.remove('hidden');
  }

  function closeWindow(win) {
    if (!win) return;
    if (window.MNRV && typeof window.MNRV.hideWindow === 'function') window.MNRV.hideWindow(win.id);
    else win.classList.add('hidden');
  }

  function initStartMenuApps() {
    document.querySelectorAll('[data-open-window]').forEach(function(item) {
      function open() {
        showWindow(item.getAttribute('data-open-window'));
        if (window.MNRV) window.MNRV.closeStartMenu();
      }
      item.addEventListener('click', open);
      item.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
    document.querySelectorAll('.close-dialog-button').forEach(function(button) {
      button.addEventListener('click', function() { closeWindow(button.closest('.win-window')); });
    });
  }

  function activeProjectFiles() {
    return projectFiles.filter(function(file) {
      return recycledFiles.indexOf(file.name) === -1 && deletedFiles.indexOf(file.name) === -1;
    });
  }

  function explorerItem(item) {
    var button = document.createElement('button');
    button.className = 'retro-explorer-item';
    button.type = 'button';
    button.dataset.path = item.path || '';
    button.dataset.kind = item.kind || 'file';
    if (item.file) {
      button.draggable = true;
      button.dataset.file = item.name;
      button.addEventListener('dragstart', function(event) {
        event.dataTransfer.setData('text/mnrv-file', item.name);
        event.dataTransfer.effectAllowed = 'move';
      });
    }
    button.innerHTML = '<img src="' + ICONS + item.icon + '" alt=""><span>' + item.name + '</span>' +
      (item.meta ? '<small>' + item.meta + '</small>' : '');
    return button;
  }

  function initExplorer() {
    var grid = document.getElementById('explorer-grid');
    var address = document.getElementById('explorer-address');
    var status = document.getElementById('explorer-status');
    var up = document.getElementById('explorer-up');
    if (!grid) return;
    var currentPath = 'computer';

    function render(path) {
      currentPath = path;
      grid.replaceChildren();
      var items;
      if (path === 'projects') {
        items = activeProjectFiles().map(function(file) {
          return { name: file.name, icon: file.icon, meta: file.type + ' · ' + file.size, kind: 'file', file: true };
        });
        address.value = 'C:\\Mijn documenten\\MNRV Projects';
        up.disabled = false;
      } else {
        items = [
          { name: '3½-inch diskette (A:)', icon: 'w98_FloppyDrive_32x32_4.png', meta: 'Verwisselbaar medium' },
          { name: 'Lokale schijf (C:)', icon: 'w98_HardDiskDrive_32x32_4.png', meta: '1,44 GB beschikbaar' },
          { name: 'MNRV CD-ROM (D:)', icon: 'w98_CdDrive_32x32_4.png', meta: 'Compact disc' },
          { name: 'Mijn documenten', icon: 'Folder_32x32_4.png', meta: 'Bestandsmap' },
          { name: 'Program Files', icon: 'FolderExe_32x32_4.png', meta: 'Bestandsmap' },
          { name: 'MNRV Projects', icon: 'FolderOpen_32x32_4.png', meta: 'Bestandsmap', kind: 'folder', path: 'projects' }
        ];
        address.value = 'Deze computer';
        up.disabled = true;
      }
      items.forEach(function(item) { grid.appendChild(explorerItem(item)); });
      status.textContent = items.length + ' object(en)';
    }

    grid.addEventListener('dblclick', function(event) {
      var item = event.target.closest('.retro-explorer-item');
      if (!item) return;
      if (item.dataset.path) render(item.dataset.path);
    });
    up.addEventListener('click', function() { render('computer'); });
    render(currentPath);
    window.addEventListener('mnrv-recycle-change', function() { render(currentPath); });
  }

  function applyDisplay(settings) {
    var desktop = document.querySelector('.desktop');
    if (!desktop) return;
    desktop.style.backgroundColor = settings.color;
    if (settings.pattern === 'dots') {
      desktop.style.backgroundImage = 'radial-gradient(rgba(255,255,255,.22) 1px, transparent 1px)';
      desktop.style.backgroundSize = '4px 4px';
    } else if (settings.pattern === 'checker') {
      desktop.style.backgroundImage = 'linear-gradient(45deg, rgba(0,0,0,.12) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.12) 75%), linear-gradient(45deg, rgba(0,0,0,.12) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.12) 75%)';
      desktop.style.backgroundSize = '8px 8px';
      desktop.style.backgroundPosition = '0 0, 4px 4px';
    } else {
      desktop.style.backgroundImage = 'none';
    }
    var schemes = {
      classic: ['#000080', '#000080'],
      plum: ['#4b174b', '#4b174b'],
      forest: ['#174b2c', '#174b2c']
    };
    var scheme = schemes[settings.scheme] || schemes.classic;
    document.documentElement.style.setProperty('--win-titlebar', scheme[0]);
    document.documentElement.style.setProperty('--win-selection-bg', scheme[1]);
    desktop.dataset.resolution = settings.resolution;
    var preview = document.getElementById('display-preview-screen');
    if (preview) {
      preview.style.backgroundColor = settings.color;
      preview.textContent = settings.resolution + ' × ' + (settings.resolution === '640' ? '480' : settings.resolution === '1024' ? '768' : '600');
    }
  }

  function initDisplayProperties() {
    var form = document.getElementById('display-properties');
    if (!form) return;
    var defaults = { color: '#008080', pattern: 'none', scheme: 'classic', resolution: '800' };
    var saved = readJson(STORAGE.display, defaults);
    var color = document.getElementById('desktop-color');
    var pattern = document.getElementById('desktop-pattern');
    var scheme = document.getElementById('window-scheme');
    var resolution = document.getElementById('desktop-resolution');

    function setFields(settings) {
      color.value = settings.color;
      pattern.value = settings.pattern;
      scheme.value = settings.scheme;
      resolution.value = settings.resolution;
    }
    function collect() {
      return { color: color.value, pattern: pattern.value, scheme: scheme.value, resolution: resolution.value };
    }
    function saveAndApply(closeAfter) {
      var settings = collect();
      writeJson(STORAGE.display, settings);
      applyDisplay(settings);
      if (closeAfter) closeWindow(document.getElementById('control-panel-window'));
    }
    form.addEventListener('submit', function(event) { event.preventDefault(); saveAndApply(true); });
    document.getElementById('display-apply').addEventListener('click', function() { saveAndApply(false); });
    document.getElementById('display-reset').addEventListener('click', function() { setFields(defaults); applyDisplay(defaults); });
    [color, pattern, scheme, resolution].forEach(function(field) {
      field.addEventListener('change', function() { applyDisplay(collect()); });
    });
    setFields(saved);
    applyDisplay(saved);
  }

  function initRecycleBin() {
    var list = document.getElementById('recycle-list');
    var zone = document.getElementById('recycle-drop-zone');
    var desktopIconEl = document.getElementById('recycle-desktop-icon');
    var status = document.getElementById('recycle-status');
    if (!list || !zone || !desktopIconEl) return;
    var selected = '';

    function render() {
      list.replaceChildren();
      recycledFiles.forEach(function(name) {
        var source = projectFiles.find(function(file) { return file.name === name; });
        if (!source) return;
        var item = explorerItem({ name: source.name, icon: source.icon, meta: source.type + ' · ' + source.size });
        item.dataset.file = source.name;
        item.setAttribute('role', 'option');
        item.addEventListener('click', function() {
          list.querySelectorAll('.selected').forEach(function(other) { other.classList.remove('selected'); });
          item.classList.add('selected');
          selected = source.name;
        });
        list.appendChild(item);
      });
      var full = recycledFiles.length > 0;
      var image = desktopIconEl.querySelector('img');
      image.src = ICONS + (full ? 'w98_RecycleBinFull_32x32_4.png' : 'w98_RecycleBinEmpty_32x32_4.png');
      var titleIcon = document.querySelector('#recycle-window .win-titlebar-icon');
      if (titleIcon) titleIcon.src = ICONS + (full ? 'w98_RecycleBinFull_16x16_4.png' : 'w98_RecycleBinEmpty_16x16_4.png');
      status.textContent = full ? recycledFiles.length + ' object(en)' : 'De Prullenbak is leeg.';
      writeJson(STORAGE.recycle, recycledFiles);
      window.dispatchEvent(new CustomEvent('mnrv-recycle-change'));
    }

    function recycle(name) {
      if (!name || recycledFiles.indexOf(name) !== -1 || deletedFiles.indexOf(name) !== -1) return;
      recycledFiles.push(name);
      selected = name;
      render();
    }

    [zone, desktopIconEl].forEach(function(target) {
      target.addEventListener('dragover', function(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; target.classList.add('drop-ready'); });
      target.addEventListener('dragleave', function() { target.classList.remove('drop-ready'); });
      target.addEventListener('drop', function(event) {
        event.preventDefault();
        target.classList.remove('drop-ready');
        recycle(event.dataTransfer.getData('text/mnrv-file'));
      });
    });

    document.getElementById('recycle-restore').addEventListener('click', function() {
      if (!selected && recycledFiles.length) selected = recycledFiles[0];
      recycledFiles = recycledFiles.filter(function(name) { return name !== selected; });
      selected = '';
      render();
    });
    document.getElementById('recycle-empty').addEventListener('click', function() {
      if (!recycledFiles.length) return;
      showWindow('recycle-confirm-dialog');
    });
    document.getElementById('recycle-confirm-yes').addEventListener('click', function() {
      deletedFiles = deletedFiles.concat(recycledFiles.filter(function(name) { return deletedFiles.indexOf(name) === -1; }));
      recycledFiles = [];
      writeJson(STORAGE.deleted, deletedFiles);
      closeWindow(document.getElementById('recycle-confirm-dialog'));
      render();
    });
    render();
  }

  function initNotepad() {
    var textarea = document.getElementById('notepad-text');
    var save = document.getElementById('notepad-save');
    var status = document.getElementById('notepad-status');
    if (!textarea) return;
    try {
      var saved = window.localStorage.getItem(STORAGE.note);
      if (saved !== null) textarea.value = saved;
    } catch (error) {}
    function saveNote() {
      try { window.localStorage.setItem(STORAGE.note, textarea.value); } catch (error) {}
      status.textContent = 'Lokaal opgeslagen om ' + new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    }
    save.addEventListener('click', saveNote);
    textarea.addEventListener('input', function() { status.textContent = 'Gewijzigd'; });
    document.getElementById('notepad-new').addEventListener('dblclick', function() {
      textarea.value = '';
      status.textContent = 'Nieuw document';
    });
  }

  function initPaint() {
    var canvas = document.getElementById('paint-canvas');
    if (!canvas) return;
    var context = canvas.getContext('2d', { alpha: false });
    var drawing = false;
    var tool = 'brush';
    var last = null;
    var color = document.getElementById('paint-color');
    var size = document.getElementById('paint-size');
    var status = document.getElementById('paint-status');

    function clearCanvas() {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      status.textContent = 'Nieuw leeg tekenvel.';
    }
    function point(event) {
      var rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    }
    function draw(event) {
      if (!drawing) return;
      var next = point(event);
      context.strokeStyle = tool === 'eraser' ? '#fff' : color.value;
      context.lineWidth = Number(size.value);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(last.x, last.y);
      context.lineTo(next.x, next.y);
      context.stroke();
      last = next;
    }
    canvas.addEventListener('pointerdown', function(event) { drawing = true; last = point(event); canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', function() { drawing = false; last = null; });
    canvas.addEventListener('pointercancel', function() { drawing = false; last = null; });
    document.querySelectorAll('.paint-tool').forEach(function(button) {
      button.addEventListener('click', function() {
        tool = button.dataset.paintTool;
        document.querySelectorAll('.paint-tool').forEach(function(other) {
          var active = other === button;
          other.classList.toggle('active', active);
          other.setAttribute('aria-pressed', String(active));
        });
        status.textContent = tool === 'eraser' ? 'Gum geselecteerd.' : 'Potlood geselecteerd.';
      });
    });
    document.getElementById('paint-clear').addEventListener('click', clearCanvas);
    document.getElementById('paint-download').addEventListener('click', function() {
      var link = document.createElement('a');
      link.download = 'MNRV-Paint.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      status.textContent = 'MNRV-Paint.png is opgeslagen.';
    });
    clearCanvas();
  }

  function playModemSound() {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    var audio = new AudioContext();
    var now = audio.currentTime;
    [440, 620, 880, 300, 1200, 760].forEach(function(frequency, index) {
      var oscillator = audio.createOscillator();
      var gain = audio.createGain();
      oscillator.type = index > 2 ? 'square' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.035, now + index * 0.12 + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + index * 0.12 + 0.1);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + index * 0.12 + 0.11);
    });
    window.setTimeout(function() { audio.close(); }, 1200);
  }

  function initDialup() {
    var button = document.getElementById('dialup-connect');
    var status = document.getElementById('dialup-status');
    var bar = document.getElementById('dialup-progress-bar');
    if (!button) return;
    var connected = readJson(STORAGE.dialup, false);
    var busy = false;

    function render() {
      status.textContent = connected ? 'Verbonden met MNRV Net op 56.000 bps.' : 'Niet verbonden.';
      button.textContent = connected ? 'Verbinding verbreken' : 'Verbinden';
      bar.style.width = connected ? '100%' : '0%';
      document.body.classList.toggle('dialup-connected', connected);
    }
    button.addEventListener('click', function() {
      if (busy) return;
      if (connected) {
        connected = false;
        writeJson(STORAGE.dialup, false);
        render();
        return;
      }
      busy = true;
      button.disabled = true;
      playModemSound();
      var steps = [
        ['Modem wordt geïnitialiseerd...', 20], ['Nummer wordt gekozen...', 45], ['Gebruikersnaam en wachtwoord worden gecontroleerd...', 72], ['Aanmelden bij het netwerk...', 90]
      ];
      steps.forEach(function(step, index) {
        window.setTimeout(function() { status.textContent = step[0]; bar.style.width = step[1] + '%'; }, index * 550);
      });
      window.setTimeout(function() {
        connected = true;
        busy = false;
        button.disabled = false;
        writeJson(STORAGE.dialup, true);
        render();
      }, steps.length * 550);
    });
    render();
  }

  function initRunDialog() {
    var form = document.getElementById('run-form');
    var input = document.getElementById('run-command');
    var status = document.getElementById('run-status');
    if (!form) return;
    var commands = {
      notepad: 'notepad-window', 'notepad.exe': 'notepad-window',
      mspaint: 'paint-window', 'mspaint.exe': 'paint-window', paint: 'paint-window',
      calc: 'calculator-window', 'calc.exe': 'calculator-window',
      command: 'command-window', 'command.com': 'command-window', cmd: 'command-window',
      winver: 'winver-window', mnrv: 'lava-window', explorer: 'computer-window'
    };
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      var command = input.value.trim().toLowerCase();
      var target = commands[command];
      if (!target) {
        status.textContent = 'Kan het bestand "' + input.value.trim() + '" niet vinden.';
        return;
      }
      status.textContent = '';
      closeWindow(document.getElementById('run-window'));
      showWindow(target);
    });
  }

  function initCalculator() {
    var keys = document.getElementById('calculator-keys');
    var display = document.getElementById('calculator-display');
    if (!keys || !display) return;
    var expression = '';
    function calculate(value) {
      var match = value.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/);
      if (!match) throw new Error('invalid');
      var left = Number(match[1]);
      var right = Number(match[3]);
      var operator = match[2];
      if (operator === '+') return left + right;
      if (operator === '-') return left - right;
      if (operator === '*') return left * right;
      if (right === 0) throw new Error('division-by-zero');
      return left / right;
    }
    ['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+','C'].forEach(function(key) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'win-btn';
      button.textContent = key;
      button.addEventListener('click', function() {
        if (key === 'C') expression = '';
        else if (key === '=') {
          try {
            expression = String(calculate(expression));
          } catch (error) { expression = 'Fout'; }
        } else {
          if (expression === 'Fout') expression = '';
          expression += key;
        }
        display.textContent = expression || '0';
      });
      keys.appendChild(button);
    });
  }

  function init() {
    initStartMenuApps();
    initExplorer();
    initDisplayProperties();
    initRecycleBin();
    initNotepad();
    initPaint();
    initDialup();
    initRunDialog();
    initCalculator();
  }

  injectDesktopIcons();
  injectStartMenuItems();
  injectWindows();
  window.MNRVRetroApps = { showWindow: showWindow };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
