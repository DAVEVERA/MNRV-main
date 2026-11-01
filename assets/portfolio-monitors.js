(() => {
  const portfolio = document.querySelector('.monitor-portfolio');
  if (!portfolio) return;

  const stage = portfolio.querySelector('.monitor-wall-stage');
  const sourceScene = portfolio.querySelector('.monitor-wall-scene');
  const focusLayer = portfolio.querySelector('.monitor-focus');
  const focusHost = portfolio.querySelector('.monitor-focus__scene-host');
  const focusTitle = portfolio.querySelector('#monitor-focus-title');
  const externalLink = portfolio.querySelector('.monitor-focus__external');
  const closeButton = portfolio.querySelector('.monitor-focus__close');
  const screenButtons = [...portfolio.querySelectorAll('button.monitor-screen')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Keep the fixed focus layer outside the section's isolated, clipped canvas.
  document.body.appendChild(focusLayer);

  let active = null;
  let returnFocus = null;
  let focusScene = null;
  let selectedScreen = null;
  let iframe = null;
  let stageRect = null;
  let closingTimer = 0;

  const animationDuration = () => (reduceMotion.matches ? 0 : 720);

  const projectFromButton = (button) => ({
    id: button.dataset.project,
    title: button.dataset.title,
    liveUrl: button.dataset.liveUrl,
    externalUrl: button.dataset.externalUrl,
    embeddable: button.dataset.embed !== 'false',
  });

  const convertButtonsToScreens = (scene) => {
    scene.querySelectorAll('button.monitor-screen').forEach((button) => {
      const screen = document.createElement('div');
      screen.className = button.className;
      screen.setAttribute('style', button.getAttribute('style') || '');
      screen.dataset.project = button.dataset.project;
      screen.innerHTML = button.innerHTML;
      button.replaceWith(screen);
    });
  };

  const fitIframe = () => {
    if (!iframe || !selectedScreen) return;
    const scaleX = selectedScreen.clientWidth / 1200;
    const scaleY = selectedScreen.clientHeight / 800;
    iframe.style.transform = `scale(${scaleX}, ${scaleY})`;
  };

  const zoomTransform = () => {
    if (!selectedScreen || !stageRect) return 'matrix(1, 0, 0, 1, 0, 0)';

    const screenRect = selectedScreen.getBoundingClientRect();
    const localCenterX = screenRect.left - stageRect.left + screenRect.width / 2;
    const localCenterY = screenRect.top - stageRect.top + screenRect.height / 2;
    const safeWidth = Math.max(320, window.innerWidth - 48);
    const safeHeight = Math.max(300, window.innerHeight - 150);
    const scale = Math.min(
      safeWidth / Math.max(screenRect.width, 1),
      safeHeight / Math.max(screenRect.height, 1),
      window.innerWidth < 680 ? 5.8 : 5.15,
    );
    const targetCenterY = Math.max(28, (window.innerHeight - 52) / 2);
    const translateX = window.innerWidth / 2 - stageRect.left - localCenterX * scale;
    const translateY = targetCenterY - stageRect.top - localCenterY * scale;

    return `matrix(${scale}, 0, 0, ${scale}, ${translateX}, ${translateY})`;
  };

  const createLiveFrame = (project) => {
    const loader = document.createElement('span');
    loader.className = 'monitor-focus__loader';
    loader.textContent = 'Website laden';
    selectedScreen.appendChild(loader);

    iframe = document.createElement('iframe');
    iframe.className = 'monitor-live-frame';
    iframe.title = `${project.title} — live website`;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allow = 'fullscreen; autoplay; clipboard-read; clipboard-write';
    iframe.addEventListener('load', () => {
      iframe?.classList.add('is-loaded');
      loader.remove();
    }, { once: true });
    selectedScreen.appendChild(iframe);
    fitIframe();
    iframe.src = project.liveUrl;
  };

  const createFrameFallback = (project) => {
    const panel = document.createElement('div');
    panel.className = 'monitor-frame-blocked';

    const heading = document.createElement('strong');
    heading.textContent = project.title;
    const explanation = document.createElement('span');
    explanation.textContent = 'Deze website staat live weergave in een ander venster niet toe.';
    const link = document.createElement('a');
    link.href = project.externalUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open live ↗';

    panel.append(heading, explanation, link);
    selectedScreen.appendChild(panel);
  };

  const openProject = (button) => {
    if (active) return;

    const project = projectFromButton(button);
    active = project;
    returnFocus = button;
    stageRect = stage.getBoundingClientRect();
    focusScene = sourceScene.cloneNode(true);
    convertButtonsToScreens(focusScene);
    focusScene.classList.add('monitor-wall-scene--focus');
    focusScene.style.left = `${stageRect.left}px`;
    focusScene.style.top = `${stageRect.top}px`;
    focusScene.style.width = `${stageRect.width}px`;
    focusScene.style.height = `${stageRect.height}px`;
    selectedScreen = focusScene.querySelector(`[data-project="${project.id}"]`);
    selectedScreen.classList.add('is-selected');
    focusScene.querySelectorAll('.monitor-screen').forEach((screen) => {
      screen.setAttribute('aria-hidden', screen === selectedScreen ? 'false' : 'true');
    });
    focusScene.querySelector('.monitor-wall-hardware')?.setAttribute('aria-hidden', 'true');

    focusTitle.textContent = project.title;
    externalLink.href = project.externalUrl;
    externalLink.setAttribute('aria-label', `Open ${project.title} in een nieuw tabblad`);
    focusHost.replaceChildren(focusScene);
    focusLayer.hidden = false;
    focusLayer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('monitor-project-open');

    requestAnimationFrame(() => {
      focusLayer.classList.add('is-visible');
      focusScene.style.transform = zoomTransform();
      if (project.embeddable) createLiveFrame(project);
      else createFrameFallback(project);
      window.setTimeout(() => closeButton.focus(), reduceMotion.matches ? 0 : 360);
    });
  };

  const finishClose = () => {
    window.clearTimeout(closingTimer);
    focusHost.replaceChildren();
    focusLayer.hidden = true;
    focusLayer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('monitor-project-open');
    iframe = null;
    selectedScreen = null;
    focusScene = null;
    stageRect = null;
    active = null;
    if (returnFocus) returnFocus.focus();
    returnFocus = null;
  };

  const closeProject = () => {
    if (!active || !focusScene) return;
    iframe?.removeAttribute('src');
    focusLayer.classList.remove('is-visible');
    focusScene.style.transform = 'matrix(1, 0, 0, 1, 0, 0)';
    closingTimer = window.setTimeout(finishClose, animationDuration() + 40);
  };

  const keepFocusInDialog = (event) => {
    if (event.key !== 'Tab' || !active) return;
    const focusable = [...focusLayer.querySelectorAll('a[href], button:not([disabled]), iframe')]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  screenButtons.forEach((button) => {
    button.addEventListener('click', () => openProject(button));
  });

  focusLayer.addEventListener('click', (event) => {
    if (event.target.closest('[data-monitor-close]')) closeProject();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && active) closeProject();
    keepFocusInDialog(event);
  });

  window.addEventListener('resize', () => {
    if (!active || !focusScene) return;
    focusScene.style.transform = zoomTransform();
    fitIframe();
  });
})();
