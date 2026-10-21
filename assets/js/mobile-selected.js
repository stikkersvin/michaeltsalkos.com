// Shared wheel geometry for desktop transitions and phone gestures.
window.portfolioWheelTransform = function (position, distance, axis = 'Y') {
  const step = 40 * Math.PI / 180;
  const radius = distance / (2 * Math.tan(step / 2));
  const angle = Math.max(-84 * Math.PI / 180, Math.min(84 * Math.PI / 180, position * step));
  const shift = radius * Math.sin(angle);
  const depth = radius * (Math.cos(angle) - 1);
  return axis === 'X'
    ? `translate3d(${shift}px, 0, ${depth}px) rotateY(${angle}rad)`
    : `translate3d(0, ${shift}px, ${depth}px) rotateX(${-angle}rad)`;
};
window.portfolioWheelKeyframes = function (from, to, distance, axis = 'Y') {
  return Array.from({ length: 17 }, (_, index) => ({
    transform: window.portfolioWheelTransform(from + (to - from) * index / 16, distance, axis)
  }));
};

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
  let opening = null;
  let hasLanded = false;
  let openingSeen = false;
  try { openingSeen = sessionStorage.getItem('portfolio-mobile-opening-seen') === '1'; } catch (error) {}
  let error = false;
  let dragPreview = null;
  let dragDirection = 0;
  let dragAxis = null;
  let dragOffset = 0;
  let dragVisualOffset = 0;
  let dragSettle = null;
  let dragReturnAnimations = [];
  const videoBackdrops = new WeakMap();
  const buttons = [];
  const preparedMedia = new Map();
  const mediaKey = (project, image) => `${project}:${image}`;
  const isVideoSource = (source) => /\.(mp4|mov|webm)(?:\?|$)/i.test(source);
  const footballImageNumber = (source) => Number(/GODILOVEFOOTBALL_(\d+)(?:\.preview)?\.(?:webp|jpe?g|png)(?:\?|$)/i.exec(source)?.[1]);
  const sourcesFor = (entry) => {
    // The lower images belong to their paired frame rather than separate slides.
    const images = entry.displayType === 'God I Love|Football|'
      ? entry.images.filter((source) => ![7, 10].includes(footballImageNumber(source))) : entry.images;
    return entry.video ? [entry.video, ...images] : images;
  };
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
  function lowerStillSource(entry, source) {
    if (entry.displayType === 'Du minder|mig om|') return source;
    if (entry.displayType !== 'God I Love|Football|') return null;
    const lowerNumber = { 5: 7, 9: 10 }[footballImageNumber(source)];
    return lowerNumber ? entry.images.find((image) => footballImageNumber(image) === lowerNumber) : null;
  }
  function createStillPair(image, entry, lowerSource) {
    const pair = document.createElement('div');
    pair.className = 'mobile-selected-still-pair';
    if (entry.displayType === 'Du minder|mig om|') pair.classList.add('mobile-selected-havtorn-still');
    pair.setAttribute('role', 'img');
    pair.setAttribute('aria-label', `${entry.name}, images above and below the navigation bar`);
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    const lowerImage = image.cloneNode();
    lowerImage.src = lowerSource;
    pair.append(image, lowerImage);
    return pair;
  }
  function prepareMedia(project, image) {
    const key = mediaKey(project, image);
    if (preparedMedia.has(key)) return preparedMedia.get(key);
    const entry = entries[project];
    const source = sourcesFor(entry)[image];
    const video = isVideoSource(source);
    const media = video ? document.createElement('video') : new Image();
    const record = { media, source, video, ready: false, disposed: false };
    preparedMedia.set(key, record);
    if (video) {
      media.muted = true;
      media.defaultMuted = true;
      media.volume = 0;
      media.playsInline = true;
      media.loop = true;
      media.preload = 'auto';
      if (entry.images[0]) media.poster = entry.images[0];
      record.promise = new Promise((resolve) => {
        record.cancel = () => resolve(false);
        media.addEventListener('loadeddata', () => {
          record.ready = !record.disposed;
          resolve(record.ready);
        }, { once: true });
        media.addEventListener('error', () => resolve(false), { once: true });
        media.src = source;
        media.load();
      });
    } else {
      media.alt = `${entry.name}, image ${image + 1} of ${sourcesFor(entry).length}`;
      media.decoding = 'async';
      media.draggable = false;
      media.src = source;
      const lowerSource = lowerStillSource(entry, source);
      if (lowerSource) record.media = createStillPair(media, entry, lowerSource);
      const images = lowerSource ? [...record.media.children] : [media];
      record.promise = Promise.all(images.map((item) => item.decode())).then(() => {
        record.ready = !record.disposed;
        return record.ready;
      }, () => false);
    }
    return record;
  }
  function discardPrepared(record) {
    record.disposed = true;
    record.cancel?.();
    record.media.remove();
    if (record.video) {
      record.media.pause();
      record.media.removeAttribute('src');
      record.media.load();
    }
  }
  function preloadNeighbours(project, image) {
    if (!viewport.matches) return;
    const count = sourcesFor(entries[project]).length;
    const neighbours = [
      [project, (image + 1) % count], [project, (image - 1 + count) % count],
      [(project + 1) % entries.length, 0], [(project - 1 + entries.length) % entries.length, 0]
    ];
    const currentKey = mediaKey(project, image);
    const keep = new Set([currentKey, ...neighbours.map(([p, i]) => mediaKey(p, i))]);
    preparedMedia.forEach((record, key) => {
      if (!keep.has(key)) { discardPrepared(record); preparedMedia.delete(key); }
    });
    neighbours.forEach(([p, i]) => {
      if (mediaKey(p, i) !== currentKey) prepareMedia(p, i);
    });
  }
  function addVideoBackdrop(video, entry) {
    if (!entry.contained || entry.displayType !== 'Du minder|mig om|' || video.tagName !== 'VIDEO') return null;
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
    dragReturnAnimations.forEach((animation) => animation.cancel());
    dragReturnAnimations = [];
    dragPreview?.querySelectorAll('video').forEach(stopVideo);
    dragPreview?.remove();
    dragPreview = null;
    dragDirection = 0;
    dragAxis = null;
    dragOffset = 0;
    dragVisualOffset = 0;
    mediaFrame.style.transform = '';
    mediaFrame.style.perspective = '';
    if (currentMedia) {
      currentMedia.style.transform = '';
      const canvas = videoBackdrops.get(currentMedia)?.canvas;
      if (canvas) canvas.style.transform = '';
    }
    mediaFrame.classList.remove('is-dragging');
  }
  const wheelTransform = window.portfolioWheelTransform;
  const wheelKeyframes = window.portfolioWheelKeyframes;
  function previewDrag(axis, offset, distance) {
    const direction = offset < 0 ? 1 : -1;
    if (!dragPreview || direction !== dragDirection || axis !== dragAxis) {
      if (direction !== dragDirection || axis !== dragAxis) resetDrag();
      dragDirection = direction;
      dragAxis = axis;
      dragOffset = offset;
      const targetProject = axis === 'Y' ? (projectIndex + direction + entries.length) % entries.length : projectIndex;
      const entry = entries[targetProject];
      const sources = sourcesFor(entry);
      const nextImage = axis === 'Y' ? 0 : (imageIndex + direction + sources.length) % sources.length;
      const prepared = prepareMedia(targetProject, nextImage);
      if (!prepared.ready) {
        // Keep the current face in place until the incoming face has pixels.
        prepared.promise.then((ready) => {
          if (ready && touchStart && dragAxis === axis && dragDirection === direction && !dragPreview) {
            previewDrag(axis, dragOffset, distance);
          }
        });
        return;
      }
      dragPreview = document.createElement('div');
      dragPreview.className = 'mobile-selected-drag-preview';
      dragPreview.classList.toggle('is-contained', entry.contained);
      dragPreview.dataset.displayType = entry.displayType;
      dragPreview.setAttribute('aria-hidden', 'true');
      dragPreview.style.transform = `translate${axis}(${direction * distance}px)`;
      dragPreview.appendChild(prepared.media);
      mediaFrame.appendChild(dragPreview);
    }
    dragOffset = offset;
    dragVisualOffset = offset;
    mediaFrame.classList.add('is-dragging');
    if (!reduceMotion.matches) {
      const position = offset / distance;
      mediaFrame.style.perspective = `${distance * 1.5}px`;
      currentMedia.style.transform = wheelTransform(position, distance, axis);
      const canvas = videoBackdrops.get(currentMedia)?.canvas;
      if (canvas) canvas.style.transform = wheelTransform(position, distance, axis);
      dragPreview.style.transform = wheelTransform(direction + position, distance, axis);
    } else mediaFrame.style.transform = `translate${axis}(${offset}px)`;
  }
  function returnFromDrag() {
    if (!dragAxis || !dragPreview || reduceMotion.matches) { resetDrag(); scheduleAutoplay(); return; }
    const timing = { duration: 440, easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)', fill: 'both' };
    const distance = dragAxis === 'X' ? mediaFrame.clientWidth : mediaFrame.clientHeight;
    const position = dragOffset / distance;
    const frames = wheelKeyframes(position, 0, distance, dragAxis);
    const animation = currentMedia.animate(frames, timing);
    const canvas = videoBackdrops.get(currentMedia)?.canvas;
    dragReturnAnimations = [animation,
      canvas?.animate(frames, timing),
      dragPreview?.animate(wheelKeyframes(dragDirection + position, dragDirection, distance, dragAxis), timing)
    ].filter(Boolean);
    dragSettle = animation;
    animation.finished.then(() => {
      if (dragSettle === animation) { resetDrag(); scheduleAutoplay(); }
    }, () => {});
  }
  function scheduleAutoplay() {
    pauseAutoplay();
    if (opening || !viewport.matches || document.hidden || !entries[projectIndex]?.autoplay
      || sourcesFor(entries[projectIndex]).length < 2) return;
    autoplayTimer = window.setTimeout(() => moveImage(1), 2000);
  }
  async function render(nextProject, nextImage = 0, axis = 'Y', direction = 1, fromOffset = null, releaseSpeed = 0) {
    if (!viewport.matches || !entries.length) return;
    pauseAutoplay();
    if (fromOffset === null) resetDrag();
    const request = ++loadId;
    const entry = entries[nextProject];
    const sources = sourcesFor(entry);
    const source = sources[nextImage];
    const prepared = prepareMedia(nextProject, nextImage);
    const isVideo = prepared.video;
    let next = prepared.media;
    if (!currentMedia) preloadNeighbours(nextProject, nextImage);
    error = false;
    stage.setAttribute('aria-busy', 'true');
    try {
      if (!await prepared.promise) throw new Error('Preview unavailable');
    } catch {
      if (request !== loadId) return;
      discardPrepared(prepared);
      preparedMedia.delete(mediaKey(nextProject, nextImage));
      error = true;
      returnFromDrag();
      stage.setAttribute('aria-busy', 'false');
      imageCount.textContent = 'Tap to retry';
      stage.onclick = () => { if (error) render(nextProject, nextImage, axis, direction); };
      return;
    }
    if (request !== loadId || !viewport.matches) return;
    preparedMedia.delete(mediaKey(nextProject, nextImage));
    // Move the decoded node out of the drag layer before removing that layer.
    next.remove();
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
    if (isVideo) next = createVideo(source, entry.name, { eager: true, prepared: next });
    currentMedia = next;
    mediaFrame.appendChild(next);
    const backdrop = addVideoBackdrop(next, entry);
    if (isVideo) next.play().catch(() => {});
    stage.dataset.displayType = entry.displayType;
    stage.classList.toggle('is-contained', entry.contained);
    caption.replaceChildren(...entry.caption.cloneNode(true).childNodes);
    imageCount.textContent = `[ ${imageIndex + 1} / ${sources.length} ]`;
    projectCount.textContent = `${projectIndex + 1} / ${entries.length}`;
    stage.setAttribute('aria-label', `${entry.name}. Swipe left or right for images; up or down for projects.`);
    stage.setAttribute('aria-busy', 'false');
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === projectIndex)));
    if (previous && !reduceMotion.matches) {
      previous.classList.add('mobile-selected-outgoing');
      previous.setAttribute('aria-hidden', 'true');
      const distance = axis === 'X' ? mediaFrame.clientWidth : mediaFrame.clientHeight;
      mediaFrame.style.perspective = `${distance * 1.5}px`;
      const offset = fromOffset || 0;
      const remaining = Math.max(1, distance - Math.abs(offset));
      const duration = fromOffset === null ? 800 : Math.max(420, Math.min(900, remaining / (0.5 + releaseSpeed * 0.45)));
      // Match the finger's release speed, then gradually coast to a stop.
      const initialSlope = Math.max(0.08, Math.min(0.85, releaseSpeed * duration / remaining * 0.25));
      const easing = fromOffset === null ? 'cubic-bezier(0.22, 0.75, 0.25, 1)' : `cubic-bezier(0.25, ${initialSlope}, 0.32, 1)`;
      const timing = { duration, easing };
      const incomingFrames = wheelKeyframes(direction + offset / distance, 0, distance, axis);
      const outgoingFrames = wheelKeyframes(offset / distance, -direction, distance, axis);
      next.animate(incomingFrames, timing);
      backdrop?.animate(incomingFrames, timing);
      videoBackdrops.get(previous)?.canvas.animate(outgoingFrames, { ...timing, fill: 'forwards' });
      previous.animate(outgoingFrames,
        { ...timing, fill: 'forwards' }).finished.then(() => retire(previous), () => retire(previous));
    } else retire(previous);
    preloadNeighbours(projectIndex, imageIndex);
    scheduleAutoplay();
  }
  function finishOpening() {
    document.documentElement.classList.remove('mobile-landing-pending');
    const run = opening;
    if (!run) return;
    opening = null;
    run.animation?.cancel();
    run.frameAnimations?.forEach((animation) => animation.cancel());
    run.barAnimation?.cancel();
    run.brackets?.remove();
    run.overlay?.querySelectorAll('video').forEach((video) => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
    run.overlay?.remove();
    root.classList.remove('is-opening');
    scheduleAutoplay();
  }
  function playOpening() {
    finishOpening();
    if (!viewport.matches || !entries.length) return;
    const run = { overlay: document.createElement('div') };
    opening = run;
    if (!reduceMotion.matches) document.documentElement.classList.add('mobile-landing-pending');
    pauseAutoplay();
    // Prepare the real project underneath while the reel starts immediately.
    // Image downloads and decoding must never delay the animation clock.
    render(0, 0);
    if (reduceMotion.matches || document.hidden) { finishOpening(); return; }
    run.overlay.className = 'mobile-selected-opening';
    run.overlay.setAttribute('aria-hidden', 'true');
    const track = document.createElement('div');
    track.className = 'mobile-selected-opening-track';
    run.overlay.appendChild(track);
    const blackFrame = document.createElement('div');
    blackFrame.className = 'mobile-selected-opening-frame';
    track.appendChild(blackFrame);
    entries.forEach((entry, index) => {
      const frame = document.createElement('div');
      frame.className = 'mobile-selected-opening-frame';
      frame.classList.toggle('is-contained', entry.contained);
      frame.dataset.displayType = entry.displayType;
      // Prefer stills: the reel never starts the projects' video playback.
      const source = entry.thumbnail || entry.images[0];
      const media = source ? new Image() : document.createElement('video');
      frame.appendChild(media);
      track.appendChild(frame);
      if (source) {
        media.alt = '';
        media.decoding = 'async';
        if (index < 3) media.fetchPriority = 'high';
        media.src = source;
        return;
      }
      if (!entry.video) return;
      media.muted = true;
      media.defaultMuted = true;
      media.playsInline = true;
      media.preload = 'auto';
      media.src = entry.video;
    });
    // Reuse the first face for a seamless final stop, without awaiting decoding.
    const last = track.children[1].cloneNode(true);
    track.appendChild(last);
    stage.appendChild(run.overlay);
    root.classList.add('is-opening');
    const openingTiming = {
      duration: 3800,
      easing: 'cubic-bezier(0.12, 0.72, 0.18, 1)',
      fill: 'forwards'
    };
    const openingStart = document.timeline.currentTime;
    const bar = document.querySelector('.site-topbar');
    run.barAnimation = bar?.animate([
      { clipPath: 'inset(calc(50% - 0.5px) 50%)' },
      { clipPath: 'inset(0px 0)' }
    ], openingTiming);
    run.brackets = document.createElement('div');
    run.brackets.className = 'mobile-selected-opening-brackets';
    run.brackets.setAttribute('aria-hidden', 'true');
    run.brackets.innerHTML = '<span>[</span><span>]</span>';
    root.appendChild(run.brackets);
    [...run.brackets.children].forEach((bracket, index) => {
      const start = index ? 0 : -8;
      const end = index ? innerWidth / 2 - 20 : -innerWidth / 2 + 12;
      bracket.animate([
        { transform: `translate(${start}px, -50%)` },
        { transform: `translate(${end}px, -50%)` }
      ], openingTiming);
    });
    run.brackets.animate([
      { opacity: 1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }
    ], { duration: openingTiming.duration, fill: 'forwards' });
    // Each face follows the front arc of a wheel. At the centre its transform
    // is exactly neutral, so the last face matches the real project beneath.
    const steps = track.children.length - 1;
    const height = stage.clientHeight;
    run.width = stage.clientWidth;
    run.height = height;
    track.style.setProperty('--opening-perspective', `${height * 1.5}px`);
    run.frameAnimations = [...track.children].map((frame, index) => {
      const positions = new Set([0, steps]);
      for (let quarter = -12; quarter <= 12; quarter++) {
        const position = index + quarter / 4;
        if (position >= 0 && position <= steps) positions.add(position);
      }
      const keyframes = [...positions].sort((a, b) => a - b).map((position) => {
        const distance = index - position;
        return {
          offset: position / steps,
          transform: wheelTransform(distance, height),
          opacity: Math.min(1, Math.max(0, (3 - Math.abs(distance)) * 2))
        };
      });
      return frame.animate(keyframes, openingTiming);
    });
    // This neutral animation provides the shared completion clock.
    run.animation = track.animate([
      { transform: 'translateZ(0)' }, { transform: 'translateZ(0)' }
    ], openingTiming);
    // Keep the bar reveal and every wheel face on the same clock.
    if (openingStart !== null) {
      [run.animation, run.barAnimation, ...run.frameAnimations, ...run.brackets.getAnimations({ subtree: true })]
        .filter(Boolean).forEach((animation) => { animation.startTime = openingStart; });
    }
    document.documentElement.classList.remove('mobile-landing-pending');
    run.animation.finished.then(() => {
      if (opening === run) finishOpening();
    }, () => {});
  }
  function selectProject(index) {
    finishOpening();
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
    finishOpening();
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
      width: mediaFrame.clientWidth, height: mediaFrame.clientHeight,
      samples: [{ x: event.clientX, y: event.clientY, time: performance.now() }]
    };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!touchStart || event.pointerId !== touchStart.id) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    const now = performance.now();
    touchStart.samples.push({ x: event.clientX, y: event.clientY, time: now });
    touchStart.samples = touchStart.samples.filter((sample) => now - sample.time <= 100);
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
      const now = performance.now();
      const recent = gesture.samples.find((sample) => now - sample.time <= 100);
      const speed = recent
        ? Math.abs((axis === 'X' ? event.clientX - recent.x : event.clientY - recent.y) / Math.max(1, now - recent.time))
        : 0;
      if (Math.abs(offset) > Math.min(120, distance * 0.2) || (Math.abs(offset) > 24 && speed > 0.45)) {
        const direction = offset < 0 ? 1 : -1;
        const nextProject = axis === 'Y' ? (projectIndex + direction + entries.length) % entries.length : projectIndex;
        const count = sourcesFor(entries[nextProject]).length;
        const nextImage = axis === 'Y' ? 0 : (imageIndex + direction + count) % count;
        render(nextProject, nextImage, axis, direction, dragVisualOffset, speed);
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
    finishOpening();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') moveImage(event.key === 'ArrowLeft' ? -1 : 1);
    else selectProject(projectIndex + (event.key === 'ArrowUp' ? -1 : 1));
  });
  function syncViewport() {
    if (viewport.matches) {
      mountRail();
      if (!hasLanded) {
        hasLanded = true;
        if (openingSeen) render(projectIndex, imageIndex);
        else {
          openingSeen = true;
          try { sessionStorage.setItem('portfolio-mobile-opening-seen', '1'); } catch (error) {}
          playOpening();
        }
      } else render(projectIndex, imageIndex);
    } else {
      finishOpening();
      pauseAutoplay();
      resetDrag();
      loadId++;
      [...mediaFrame.children].forEach(retire);
      currentMedia = null;
      preparedMedia.forEach(discardPrepared);
      preparedMedia.clear();
    }
  }
  viewport.addEventListener('change', syncViewport);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { finishOpening(); pauseAutoplay(); }
    else scheduleAutoplay();
  });
  window.addEventListener('resize', () => {
    if (opening?.animation && (opening.width !== stage.clientWidth || opening.height !== stage.clientHeight)) {
      finishOpening();
    }
  });
  reduceMotion.addEventListener('change', finishOpening);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && viewport.matches) {
      finishOpening();
      scheduleAutoplay();
    }
  });
  syncViewport();
  return { nextProject: () => selectProject(projectIndex + 1) };
};
