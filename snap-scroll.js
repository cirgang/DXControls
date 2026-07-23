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
  let footerIntent = false;
  let footerCarry = 0;

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
    footerIntent = false;
    footerCarry = 0;
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

        const lastIndex = snapPanels.length - 1;
        const maximumScrollY =
          document.documentElement.scrollHeight - window.innerHeight;

        if (
          targetIndex === lastIndex &&
          footerIntent &&
          maximumScrollY > animationDestinationY + 2
        ) {
          footerMode = true;
          footerIntent = false;
          window.scrollTo(0, clamp(
            animationDestinationY + footerCarry,
            animationDestinationY,
            maximumScrollY
          ));
          footerCarry = 0;
        } else {
          root.classList.remove('is-wheel-snapping');
        }
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
      const footerScrollY = clamp(
        window.scrollY + delta,
        lastPanelY,
        maximumScrollY
      );
      window.scrollTo(0, footerScrollY);

      if (direction < 0 && footerScrollY <= lastPanelY + 1) {
        footerMode = false;
        root.classList.remove('is-wheel-snapping');
        window.scrollTo(0, lastPanelY);
      }
      return;
    }

    if (direction !== lastDirection) wheelAccumulator = 0;
    lastDirection = direction;

    if (isAnimating) {
      event.preventDefault();
      const destinationDirection = Math.sign(
        animationDestinationY - window.scrollY
      );
      const remainingDistance =
        animationDestinationY - window.scrollY;

      if (
        targetIndex === lastIndex &&
        direction > 0 &&
        remainingDistance >= 0 &&
        remainingDistance <= 96 &&
        maximumScrollY > lastPanelY + 2
      ) {
        window.cancelAnimationFrame(animationFrame);
        window.clearTimeout(settleTimer);
        isAnimating = false;
        footerMode = true;
        root.classList.add('is-wheel-snapping');
        window.scrollTo(0, clamp(
          lastPanelY + delta,
          lastPanelY,
          maximumScrollY
        ));
        return;
      }

      if (targetIndex === lastIndex && direction > 0) {
        footerIntent = true;
        footerCarry = Math.max(footerCarry, Math.abs(delta));
      }

      if (direction !== destinationDirection && destinationDirection !== 0) {
        animateToPanel(targetIndex + direction, 480);
      } else {
        animationStartedAt -= clamp(Math.abs(delta) * .04, 8, 48);
        animationDuration = Math.max(380, animationDuration - 6);
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
      footerIntent = false;
      footerCarry = 0;
      root.classList.add('is-wheel-snapping');
      window.scrollTo(0, clamp(
        window.scrollY + delta,
        lastPanelY,
        maximumScrollY
      ));
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
    root.classList.remove('is-wheel-snapping');
  };

  document.addEventListener('click', leaveFooterMode, true);
  window.addEventListener('hashchange', leaveFooterMode);
})();
