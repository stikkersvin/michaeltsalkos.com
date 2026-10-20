// Phone-only Selected view: a project rail and one active media frame.
window.createMobileSelected = function (entries, { viewport, reduceMotion, createVideo, stopVideo }) {
  const root = document.createElement('section');
  root.className = 'mobile-selected';
  root.setAttribute('aria-label', 'Selected projects');
  root.innerHTML = `<nav class="mobile-selected-rail" aria-label="Choose a project"></nav>
    <div class="mobile-selected-stage" role="group" tabindex="0" aria-label="Project images">
      <div class="mobile-selected-media"></div>
      <div class="mobile-selected-caption"></div>
      <span class="mobile-selected-image-count"></span>
      <button class="mobile-selected-next" type="button" aria-label="Next project">⌄</button>
    </div>
    <span class="mobile-selected-project-count" aria-live="polite"></span>`;
  document.body.appendChild(root);
  document.body.classList.add('has-mobile-selected');
  const rail = root.querySelector('.mobile-selected-rail');
  const stage = root.querySelector('.mobile-selected-stage');
  const mediaFrame = root.querySelector('.mobile-selected-media');
  const caption = root.querySelector('.mobile-selected-caption');
  const imageCount = root.querySelector('.mobile-selected-image-count');
  const projectCount = root.querySelector('.mobile-selected-project-count');
  let projectIndex = 0;
  let imageIndex = 0;
  let loadId = 0;
  let currentMedia = null;
  let autoplayTimer = null;
  let error = false;
  let dragPreview = null;
  let dragDirection = 0;
  let dragAxis = null;
  let dragOffset = 0;
  let dragSettle = null;
  const videoBackdrops = new WeakMap();
  const buttons = [];
  const sourcesFor = (entry) => entry.video ? [entry.video, ...entry.images] : entry.images;
  const pauseAutoplay = () => window.clearTimeout(autoplayTimer);
  const retire = (media) => {
    const backdrop = videoBackdrops.get(media);
    if (backdrop) {
      backdrop.stop();
      backdrop.canvas.getAnimations().forEach((animation) => animation.cancel());
      backdrop.canvas.remove();
      videoBackdrops.delete(media);
    }
    if (media?.tagName === 'VIDEO') stopVideo(media);
    media?.getAnimations().forEach((animation) => animation.cancel());
    media?.remove();
  };
  function addVideoBackdrop(video, entry) {
    if (entry.displayType !== 'Du minder|mig om|' || video.tagName !== 'VIDEO') return null;
    video.classList.add('mobile-selected-havtorn-video');
    const canvas = document.createElement('canvas');
    canvas.className = 'mobile-selected-video-backdrop';
    canvas.setAttribute('aria-hidden', 'true');
    // Reuse the playing video's frames, keeping both layers in exact sync
    // without downloading or decoding a second copy of the video.
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return null;
    mediaFrame.insertBefore(canvas, video);
    let frameRequest;
    let stopped = false;
    const usesVideoFrames = typeof video.requestVideoFrameCallback === 'function';
    const draw = () => {
      if (stopped) return;
      if (video.readyState >= 2 && viewport.matches && !document.hidden) {
        const height = Math.min(600, mediaFrame.clientHeight);
        const width = Math.max(1, Math.round(height * mediaFrame.clientWidth / mediaFrame.clientHeight));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      frameRequest = usesVideoFrames ? video.requestVideoFrameCallback(draw) : window.requestAnimationFrame(draw);
    };
    const stop = () => {
      stopped = true;
      if (usesVideoFrames) video.cancelVideoFrameCallback(frameRequest);
      else window.cancelAnimationFrame(frameRequest);
    };
    videoBackdrops.set(video, { canvas, stop });
    draw();
    return canvas;
  }
  function resetDrag() {
    dragSettle?.cancel();
    dragSettle = null;
    dragPreview?.querySelectorAll('video').forEach(stopVideo);
    dragPreview?.remove();
    dragPreview = null;
    dragDirection = 0;
    dragAxis = null;
    dragOffset = 0;
    mediaFrame.style.transform = '';
    mediaFrame.classList.remove('is-dragging');
  }
  function previewDrag(axis, offset, distance) {
    const direction = offset < 0 ? 1 : -1;
    if (!dragPreview || direction !== dragDirection || axis !== dragAxis) {
      resetDrag();
      dragDirection = direction;
      dragAxis = axis;
      const entry = entries[axis === 'Y' ? (projectIndex + direction + entries.length) % entries.length : projectIndex];
      const sources = sourcesFor(entry);
      const nextImage = axis === 'Y' ? 0 : (imageIndex + direction + sources.length) % sources.length;
      const source = sources[nextImage];
      const isVideo = /\.(mp4|mov|webm)(?:\?|$)/i.test(source);
      // Use the supplied still as a video poster during the drag when possible.
      const preview = isVideo && !entry.images[0]
        ? createVideo(source, entry.name, { eager: true }) : new Image();
      if (preview.tagName === 'IMG') {
        preview.src = isVideo ? entry.images[0] : source;
        preview.alt = '';
        preview.draggable = false;
      }
      dragPreview = document.createElement('div');
      dragPreview.className = 'mobile-selected-drag-preview';
      dragPreview.classList.toggle('is-contained', entry.contained);
      dragPreview.dataset.displayType = entry.displayType;
      dragPreview.setAttribute('aria-hidden', 'true');
      dragPreview.style.transform = `translate${axis}(${direction * distance}px)`;
      dragPreview.appendChild(preview);
      mediaFrame.appendChild(dragPreview);
    }
    dragOffset = offset;
    mediaFrame.classList.add('is-dragging');
    mediaFrame.style.transform = `translate${axis}(${offset}px)`;
  }
  function returnFromDrag() {
    if (!dragAxis || reduceMotion.matches) { resetDrag(); scheduleAutoplay(); return; }
    const animation = mediaFrame.animate([
      { transform: `translate${dragAxis}(${dragOffset}px)` }, { transform: 'translate(0)' }
    ], { duration: 250, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    dragSettle = animation;
    animation.finished.then(() => {
      if (dragSettle === animation) { resetDrag(); scheduleAutoplay(); }
    }, () => {});
  }
  function scheduleAutoplay() {
    pauseAutoplay();
    if (!viewport.matches || document.hidden || !entries[projectIndex]?.autoplay
      || sourcesFor(entries[projectIndex]).length < 2) return;
    autoplayTimer = window.setTimeout(() => moveImage(1), 2000);
  }
  async function render(nextProject, nextImage = 0, axis = 'Y', direction = 1, fromOffset = null) {
    if (!viewport.matches || !entries.length) return;
    pauseAutoplay();
    if (fromOffset === null) resetDrag();
    const request = ++loadId;
    const entry = entries[nextProject];
    const sources = sourcesFor(entry);
    const source = sources[nextImage];
    const isVideo = /\.(mp4|mov|webm)(?:\?|$)/i.test(source);
    const next = isVideo ? createVideo(source, entry.name, { eager: true }) : new Image();
    error = false;
    stage.setAttribute('aria-busy', 'true');
    try {
      if (isVideo) {
        if (entry.images[0]) next.poster = entry.images[0];
        await new Promise((resolve, reject) => {
          next.addEventListener('loadeddata', resolve, { once: true });
          next.addEventListener('error', reject, { once: true });
          next.load();
        });
      } else {
        next.alt = `${entry.name}, image ${nextImage + 1} of ${sources.length}`;
        next.decoding = 'async';
        next.draggable = false;
        next.src = source;
        await next.decode();
      }
    } catch {
      retire(next);
      if (request !== loadId) return;
      error = true;
      returnFromDrag();
      stage.setAttribute('aria-busy', 'false');
      imageCount.textContent = 'Tap to retry';
      stage.onclick = () => { if (error) render(nextProject, nextImage, axis, direction); };
      return;
    }
    if (request !== loadId || !viewport.matches) { retire(next); return; }
    resetDrag();
    mediaFrame.querySelectorAll('.mobile-selected-outgoing').forEach(retire);
    const previous = currentMedia;
    previous?.getAnimations().forEach((animation) => animation.cancel());
    if (previous) {
      const bounds = previous.getBoundingClientRect();
      previous.style.width = `${bounds.width}px`;
      previous.style.height = `${bounds.height}px`;
      previous.style.objectFit = getComputedStyle(previous).objectFit;
    }
    if (previous?.tagName === 'VIDEO') stopVideo(previous);
    projectIndex = nextProject;
    imageIndex = nextImage;
    currentMedia = next;
    mediaFrame.appendChild(next);
    const backdrop = addVideoBackdrop(next, entry);
    stage.dataset.displayType = entry.displayType;
    stage.classList.toggle('is-contained', entry.contained);
    caption.replaceChildren(...entry.caption.cloneNode(true).childNodes);
    imageCount.textContent = `${imageIndex + 1} / ${sources.length}`;
    projectCount.textContent = `${projectIndex + 1} / ${entries.length}`;
    stage.setAttribute('aria-label', `${entry.name}. Swipe left or right for images; up or down for projects.`);
    stage.setAttribute('aria-busy', 'false');
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === projectIndex)));
    if (previous && !reduceMotion.matches) {
      previous.classList.add('mobile-selected-outgoing');
      previous.setAttribute('aria-hidden', 'true');
      const distance = axis === 'X' ? mediaFrame.clientWidth : mediaFrame.clientHeight;
      const offset = fromOffset || 0;
      const duration = fromOffset === null ? 550 : Math.max(180, 450 * (1 - Math.abs(offset) / distance));
      const timing = { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
      const incomingFrames = [{ transform: `translate${axis}(${direction * distance + offset}px)` }, { transform: 'translate(0)' }];
      const outgoingFrames = [{ transform: `translate${axis}(${offset}px)` }, { transform: `translate${axis}(${-direction * distance}px)` }];
      next.animate(incomingFrames, timing);
      backdrop?.animate(incomingFrames, timing);
      videoBackdrops.get(previous)?.canvas.animate(outgoingFrames, { ...timing, fill: 'forwards' });
      previous.animate(outgoingFrames,
        { ...timing, fill: 'forwards' }).finished.then(() => retire(previous), () => retire(previous));
    } else retire(previous);
    scheduleAutoplay();
  }
  function selectProject(index) {
    const next = (index + entries.length) % entries.length;
    if (next === projectIndex && currentMedia) {
      loadId++;
      error = false;
      stage.setAttribute('aria-busy', 'false');
      scheduleAutoplay();
      return;
    }
    render(next, 0, 'Y', index >= projectIndex ? 1 : -1);
  }
  function moveImage(direction) {
    if (error || !currentMedia) return;
    const sources = sourcesFor(entries[projectIndex]);
    if (sources.length < 2) return;
    render(projectIndex, (imageIndex + direction + sources.length) % sources.length, 'X', direction);
  }
  let mountedRail = false;
  function mountRail() {
    if (mountedRail) return;
    mountedRail = true;
    entries.forEach((entry, index) => {
      const button = document.createElement('button');
      button.className = 'mobile-selected-project';
      button.type = 'button';
      button.setAttribute('aria-label', entry.name);
      button.setAttribute('aria-pressed', 'false');
      button.dataset.displayType = entry.displayType;
      if (entry.thumbnail || entry.images[0]) {
        const thumb = new Image();
        thumb.src = entry.thumbnail || entry.images[0];
        thumb.loading = 'lazy';
        thumb.decoding = 'async';
        thumb.alt = '';
        button.appendChild(thumb);
      } else {
        const videoLabel = document.createElement('span');
        videoLabel.className = 'mobile-selected-video-label';
        videoLabel.textContent = '▶';
        button.appendChild(videoLabel);
      }
      const label = document.createElement('span');
      label.className = 'mobile-selected-project-label';
      label.append(...entry.caption.cloneNode(true).childNodes);
      button.appendChild(label);
      button.addEventListener('click', () => selectProject(index));
      buttons.push(button);
      rail.appendChild(button);
    });
  }
  let touchStart = null;
  let suppressClickUntil = 0;
  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button') || !currentMedia) return;
    pauseAutoplay();
    loadId++;
    resetDrag();
    stage.setAttribute('aria-busy', 'false');
    mediaFrame.querySelectorAll('.mobile-selected-outgoing').forEach(retire);
    currentMedia.getAnimations().forEach((animation) => animation.cancel());
    videoBackdrops.get(currentMedia)?.canvas.getAnimations().forEach((animation) => animation.cancel());
    touchStart = {
      x: event.clientX, y: event.clientY, id: event.pointerId, time: performance.now(), axis: null,
      width: mediaFrame.clientWidth, height: mediaFrame.clientHeight
    };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!touchStart || event.pointerId !== touchStart.id) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    if (!touchStart.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      touchStart.axis = Math.abs(dx) > Math.abs(dy) ? 'X' : 'Y';
    }
    const axis = touchStart.axis;
    const distance = axis === 'X' ? touchStart.width : touchStart.height;
    const offset = Math.max(-distance * 0.98, Math.min(distance * 0.98, axis === 'X' ? dx : dy));
    if (axis === 'X' && sourcesFor(entries[projectIndex]).length < 2) return;
    previewDrag(axis, offset, distance);
  });
  stage.addEventListener('pointerup', (event) => {
    if (!touchStart || event.pointerId !== touchStart.id) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    const gesture = touchStart;
    touchStart = null;
    if (dragAxis) {
      suppressClickUntil = performance.now() + 500;
      const axis = dragAxis;
      const offset = dragOffset;
      const distance = axis === 'X' ? gesture.width : gesture.height;
      const speed = Math.abs(offset) / Math.max(1, performance.now() - gesture.time);
      if (Math.abs(offset) > Math.min(120, distance * 0.2) || (Math.abs(offset) > 24 && speed > 0.45)) {
        const direction = offset < 0 ? 1 : -1;
        const nextProject = axis === 'Y' ? (projectIndex + direction + entries.length) % entries.length : projectIndex;
        const count = sourcesFor(entries[nextProject]).length;
        const nextImage = axis === 'Y' ? 0 : (imageIndex + direction + count) % count;
        render(nextProject, nextImage, axis, direction, offset);
      } else returnFromDrag();
    } else if (Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      suppressClickUntil = performance.now() + 500;
      scheduleAutoplay();
    } else scheduleAutoplay();
  });
  stage.addEventListener('pointercancel', () => { touchStart = null; returnFromDrag(); });
  stage.addEventListener('click', (event) => {
    if (event.target.closest('button') || performance.now() < suppressClickUntil || error) return;
    const bounds = stage.getBoundingClientRect();
    moveImage(event.clientX < bounds.left + bounds.width / 2 ? -1 : 1);
  });
  stage.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') moveImage(event.key === 'ArrowLeft' ? -1 : 1);
    else selectProject(projectIndex + (event.key === 'ArrowUp' ? -1 : 1));
  });
  root.querySelector('.mobile-selected-next').addEventListener('click', () => selectProject(projectIndex + 1));
  function syncViewport() {
    if (viewport.matches) {
      mountRail();
      render(projectIndex, imageIndex);
    } else {
      pauseAutoplay();
      resetDrag();
      loadId++;
      [...mediaFrame.children].forEach(retire);
      currentMedia = null;
    }
  }
  viewport.addEventListener('change', syncViewport);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAutoplay();
    else scheduleAutoplay();
  });
  syncViewport();
  return { nextProject: () => selectProject(projectIndex + 1) };
};
