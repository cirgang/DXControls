(() => {
  const desktopSnap = window.matchMedia('(min-width: 901px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const snapPanels = [...document.querySelectorAll('[data-snap-panel]')];

  if (!desktopSnap.matches || reducedMotion.matches || snapPanels.length < 2) {
    return;
  }

  const root = document.documentElement;
  const nav = document.querySelector('nav');
  let wheelAccumulator = 0;
  let lastDirection = 0;
  let animationFrame = 0;
  let settleTimer = 0;
  let targetIndex = null;
  let isAnimating = false;
  let animationStartedAt = 0;
  let animationDuration = 600;
  let animationStartY = 0;
  let animationDestinationY = 0;
  let footerMode = false;
  let footerInputLockUntil = 0;
  let wheelCooldownUntil = 0;

  const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum);

  const snapOffset = () => {
    const cssOffset = Number.parseFloat(
      window.getComputedStyle(root).scrollPaddingTop
    );
    return Number.isFinite(cssOffset) ? cssOffset : nav.offsetHeight;
  };

  const panelY = (index) => clamp(
    snapPanels[index].offsetTop - snapOffset(),
    0,
    document.documentElement.scrollHeight - window.innerHeight
  );

  const nearestPanelIndex = () => snapPanels.reduce(
    (nearest, panel, index) =>
      Math.abs(panelY(index) - window.scrollY) <
      Math.abs(panelY(nearest) - window.scrollY) ? index : nearest,
    0
  );

  const animateToPanel = (index, duration = 600) => {
    window.cancelAnimationFrame(animationFrame);
    window.clearTimeout(settleTimer);

    footerMode = false;
    footerInputLockUntil = 0;
    wheelCooldownUntil = 0;
    targetIndex = clamp(index, 0, snapPanels.length - 1);
    animationStartY = window.scrollY;
    animationDestinationY = panelY(targetIndex);
    animationStartedAt = performance.now();
    animationDuration = duration;
    isAnimating = true;
    root.classList.add('is-wheel-snapping');

    const update = (now) => {
      const progress = Math.min(
        (now - animationStartedAt) / animationDuration,
        1
      );
      const eased = 1 - Math.pow(1 - progress, 4);
      window.scrollTo(
        0,
        animationStartY +
        (animationDestinationY - animationStartY) * eased
      );

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(update);
      } else {
        window.scrollTo(0, animationDestinationY);
        isAnimating = false;
        wheelAccumulator = 0;
        wheelCooldownUntil = performance.now() + 180;
        root.classList.remove('is-wheel-snapping');
      }
    };

    animationFrame = window.requestAnimationFrame(update);
  };

  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const deltaMultiplier =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 :
      event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
    const delta = event.deltaY * deltaMultiplier;
    const direction = Math.sign(delta);
    if (!direction) return;

    const lastIndex = snapPanels.length - 1;
    const lastPanelY = panelY(lastIndex);
    const maximumScrollY =
      document.documentElement.scrollHeight - window.innerHeight;

    if (footerMode) {
      event.preventDefault();

      if (
        direction > 0 &&
        performance.now() < footerInputLockUntil
      ) {
        return;
      }

      footerInputLockUntil = 0;
      const footerStepDistance = Math.max(
        (maximumScrollY - lastPanelY) / 2,
        1
      );
      const footerScrollY = clamp(
        window.scrollY +
        direction * Math.max(Math.abs(delta), footerStepDistance),
        lastPanelY,
        maximumScrollY
      );
      window.scrollTo(0, footerScrollY);

      if (direction < 0 && footerScrollY <= lastPanelY + 1) {
        footerMode = false;
        footerInputLockUntil = 0;
        root.classList.remove('is-wheel-snapping');
        window.scrollTo(0, lastPanelY);
      }
      return;
    }

    if (
      !isAnimating &&
      direction === lastDirection &&
      performance.now() < wheelCooldownUntil
    ) {
      event.preventDefault();
      return;
    }

    if (direction !== lastDirection) wheelAccumulator = 0;
    lastDirection = direction;

    if (isAnimating) {
      event.preventDefault();
      const destinationDirection = Math.sign(
        animationDestinationY - window.scrollY
      );

      if (direction !== destinationDirection && destinationDirection !== 0) {
        animateToPanel(targetIndex + direction, 480);
      }
      return;
    }

    const currentIndex = nearestPanelIndex();

    if (
      currentIndex === lastIndex &&
      direction > 0 &&
      window.scrollY >= lastPanelY - 2 &&
      maximumScrollY > lastPanelY + 2
    ) {
      event.preventDefault();
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(settleTimer);
      isAnimating = false;
      footerMode = true;
      footerInputLockUntil = performance.now() + 180;
      wheelCooldownUntil = 0;
      root.classList.add('is-wheel-snapping');
      window.scrollTo(
        0,
        lastPanelY + (maximumScrollY - lastPanelY) / 2
      );
      return;
    }

    event.preventDefault();
    wheelAccumulator += delta;
    const threshold = Math.min(52, window.innerHeight * .07);

    if (Math.abs(wheelAccumulator) >= threshold) {
      wheelAccumulator = 0;
      animateToPanel(currentIndex + direction);
      return;
    }

    root.classList.add('is-wheel-snapping');
    const resistedOffset = clamp(wheelAccumulator * .16, -28, 28);
    window.scrollTo(0, panelY(currentIndex) + resistedOffset);

    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(
      () => animateToPanel(currentIndex, 360),
      90
    );
  }, { passive: false });

  const leaveFooterMode = () => {
    if (!footerMode) return;
    footerMode = false;
    footerInputLockUntil = 0;
    wheelCooldownUntil = 0;
    root.classList.remove('is-wheel-snapping');
  };

  document.addEventListener('click', leaveFooterMode, true);
  window.addEventListener('hashchange', leaveFooterMode);
})();
