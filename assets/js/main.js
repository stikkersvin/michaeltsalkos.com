    const displayTypes = Array.from(document.querySelectorAll('.display-type'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const workGrid = document.querySelector('.work-grid');
    const projects = Array.from(document.querySelectorAll('.project'));
    const viewButtons = document.querySelectorAll('[data-view]');
    const quickView = document.querySelector('.quick-view');
    const quickViewLoader = document.createElement('span');
    quickViewLoader.className = 'quick-view-loader';
    quickViewLoader.setAttribute('aria-hidden', 'true');
    document.body.appendChild(quickViewLoader);
    const scrollCue = document.querySelector('.scroll-cue');
    const spatialIntro = document.querySelector('.spatial-intro');
    const mobileViewport = window.matchMedia('(max-width: 760px) and (pointer: coarse)');
    const oDaysProject = document.querySelector('[data-display-type="O Days|Volunteer|Merchandise"]');
    const godFootballProject = document.querySelector('[data-display-type="God I Love|Football|"]');
    const nightJourneysProject = document.querySelector('[data-display-type="Night|Journeys|"]');
    const homeShirtProject = document.querySelector('[data-display-type="Home|Shirt|24/25"]');
    const displayTypeProjects = projects.filter((project) => project.dataset.displayType);
    function displayTypeWords(project) {
      const displayType = document.body.classList.contains('dark') && project.dataset.darkDisplayType
        ? project.dataset.darkDisplayType
        : project.dataset.displayType;
      return project.dataset.displayType === 'Houndstooth||'
        ? ['Houndstooth Magazine', 'The Community and', 'Network Issue']
        : displayType.split('|').filter(Boolean);
    }

    function renderDisplayTypeLayer(project, layer) {
      layer.replaceChildren();
      displayTypeWords(project).forEach((text) => {
        const word = document.createElement('span');
        word.textContent = text;
        layer.appendChild(word);
      });
    }

    const displayTypeLayers = displayTypeProjects.map((project) => {
      const layer = document.createElement('div');
      layer.className = 'display-type display-type-project';
      layer.setAttribute('aria-hidden', 'true');
      const words = displayTypeWords(project);
      if (project.dataset.displayType === 'O Days|Volunteer|Merchandise') {
        layer.classList.add('display-type-case-sensitive');
      }
      if (project.dataset.displayType === 'Houndstooth||') {
        layer.classList.add('display-type-houndstooth');
      }
      if (words.length === 1) layer.classList.add('display-type-single');
      if (words.length === 2) layer.classList.add('display-type-compact');
      renderDisplayTypeLayer(project, layer);
      workGrid.insertBefore(layer, workGrid.firstElementChild.nextElementSibling);
      return { project, layer };
    });
    displayTypes.push(...displayTypeLayers.map(({ layer }) => layer));
    let activeQuickViewProject = null;
    let quickViewIndex = 0;
    const loadedImageSources = new Map();
    let displayTypeUpdateQueued = false;
    let activeView = 'spatial';
    let spatialScrollPosition = window.scrollY;

    function quickViewImages(project) {
      return project.dataset.quickView ? project.dataset.quickView.split('|') : [];
    }

    if (oDaysProject) {
      const images = quickViewImages(oDaysProject);
      const openingPhotos = images.filter((source) => /ODAYS_Instagram_[6-9](?:\.preview)?\.(?:jpg|webp)$/.test(source));
      const openingPhoto = openingPhotos[Math.floor(Math.random() * openingPhotos.length)];
      if (openingPhoto) {
        const remainingImages = images.filter((source) => source !== openingPhoto);
        for (let i = remainingImages.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remainingImages[i], remainingImages[j]] = [remainingImages[j], remainingImages[i]];
        }
        const orderedImages = [openingPhoto, ...remainingImages];
        oDaysProject.dataset.quickView = orderedImages.join('|');
        const gallery = oDaysProject.querySelector('.list-dropdown-gallery');
        const galleryImages = new Map([...gallery.querySelectorAll('img')].map((image) => [image.getAttribute('src'), image]));
        orderedImages.forEach((source) => {
          const image = galleryImages.get(source);
          if (image) gallery.appendChild(image);
        });
      }
    }

    function imageSourceKey(source) {
      return new URL(source, window.location.href).href;
    }

    function setProgressImage(image, source, options = {}) {
      const {
        delay = 120,
        onStart = () => {},
        onProgress = () => {},
        onComplete = () => {},
        onError = () => {}
      } = options;
      const key = imageSourceKey(source);
      const cachedSource = loadedImageSources.get(key);
      const loadId = `${Date.now()}-${Math.random()}`;
      image.dataset.progressLoadId = loadId;

      if (cachedSource) {
        image.src = cachedSource;
        onComplete();
        return;
      }

      let isDone = false;
      let isVisible = false;
      const showTimer = window.setTimeout(() => {
        if (isDone || image.dataset.progressLoadId !== loadId) return;
        isVisible = true;
        onStart();
        onProgress(0);
      }, delay);

      const finish = () => {
        if (image.dataset.progressLoadId !== loadId) return;
        isDone = true;
        window.clearTimeout(showTimer);
        onComplete();
      };

      const fallbackToNativeLoad = () => {
        image.onload = () => {
          loadedImageSources.set(key, source);
          finish();
        };
        image.onerror = () => {
          finish();
          onError();
        };
        image.src = source;
      };

      fetch(key)
        .then((response) => {
          if (!response.ok || !response.body) throw new Error('Image progress unavailable');
          const total = Number(response.headers.get('content-length')) || 0;
          const reader = response.body.getReader();
          const chunks = [];
          let received = 0;

          const read = () => reader.read().then(({ done, value }) => {
            if (image.dataset.progressLoadId !== loadId) return null;
            if (done) return chunks;
            chunks.push(value);
            received += value.length;
            if (total && isVisible) {
              onProgress(Math.min(99, Math.round((received / total) * 100)));
            }
            return read();
          });

          return read().then((loadedChunks) => {
            if (!loadedChunks || image.dataset.progressLoadId !== loadId) return;
            const blob = new Blob(loadedChunks, {
              type: response.headers.get('content-type') || 'image/*'
            });
            const objectUrl = URL.createObjectURL(blob);
            loadedImageSources.set(key, objectUrl);
            image.onload = () => finish();
            image.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              loadedImageSources.delete(key);
              fallbackToNativeLoad();
            };
            image.src = objectUrl;
            if (isVisible) onProgress(100);
          });
        })
        .catch(fallbackToNativeLoad);
    }

    if (nightJourneysProject) {
      const spatialGrid = nightJourneysProject.querySelector('.night-journeys-spatial-grid');
      const undercategories = nightJourneysProject.querySelectorAll('.list-dropdown-row[data-quick-view]');

      [...undercategories].forEach((row) => {
        const label = row.children[1]?.textContent.trim() || 'Night Journeys';
        const spatialSource = row.dataset.spatialImage || quickViewImages(row)[0];
        [spatialSource].filter(Boolean).forEach((source) => {
          const item = document.createElement('figure');
          item.className = 'night-journeys-spatial-item';

          const imageStage = document.createElement('span');
          imageStage.className = 'night-journeys-spatial-image';

          const image = document.createElement('img');
          image.src = source;
          image.alt = '';
          image.loading = 'lazy';
          image.decoding = 'async';

          const caption = document.createElement('figcaption');
          caption.textContent = label;

          imageStage.appendChild(image);
          item.append(imageStage, caption);
          spatialGrid.appendChild(item);
        });
      });
    }

    const mobileSpatialCatalogue = document.querySelector('.mobile-spatial-catalogue');
    const mobileSlideshows = [];
    const previewVideoObserver = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting && !document.hidden) {
          if (!target.getAttribute('src')) target.src = target.dataset.previewSource;
          target.autoplay = true;
          target.play().catch(() => {});
        }
        else target.pause();
      });
    }, { threshold: 0.1 });
    function createPreviewVideo(source, name, { eager = false } = {}) {
      const video = document.createElement('video');
      video.dataset.previewSource = source;
      if (eager) video.src = source;
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.autoplay = eager;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.preload = eager ? 'auto' : 'none';
      video.setAttribute('aria-label', `${name} video preview`);
      previewVideoObserver.observe(video);
      return video;
    }
    function mountVideoSlides(container, firstVideo, videoSource, stillImages, name) {
      const sources = [videoSource, ...stillImages];
      let index = 0;
      let current = firstVideo;
      let loadId = 0;
      let outgoing = null;
      firstVideo.poster = stillImages[0];
      container.classList.add('mixed-project-preview');
      container.tabIndex = 0;
      container.dataset.cursorDirection = 'next';
      container.setAttribute('aria-label', `${name}. Left and Right browse video and images.`);
      const counter = document.createElement('span');
      counter.className = 'spatial-project-counter mixed-preview-counter';
      counter.setAttribute('aria-live', 'polite');
      const updateCounter = () => { counter.textContent = `${index + 1} / ${sources.length}`; };
      const stopVideo = (media) => {
        if (media?.tagName !== 'VIDEO') return;
        media.pause();
        previewVideoObserver.unobserve(media);
      };
      const move = async (direction) => {
        const nextIndex = (index + direction + sources.length) % sources.length;
        const request = ++loadId;
        const isVideo = nextIndex === 0;
        const next = isVideo ? createPreviewVideo(videoSource, name, { eager: true }) : new Image();
        if (isVideo) {
          next.poster = stillImages[0];
          await new Promise((resolve) => {
            next.addEventListener('loadeddata', resolve, { once: true });
            next.addEventListener('error', resolve, { once: true });
            next.load();
          });
        } else {
          next.src = sources[nextIndex];
          next.alt = `${name}, image ${nextIndex}`;
          next.draggable = false;
          await next.decode().catch(() => {});
        }
        if (request !== loadId) { stopVideo(next); return; }
        stopVideo(current);
        stopVideo(outgoing);
        outgoing?.getAnimations().forEach((animation) => animation.cancel());
        outgoing?.remove();
        current.getAnimations().forEach((animation) => animation.cancel());
        const previous = current;
        previous.replaceWith(next);
        current = next;
        index = nextIndex;
        updateCounter();
        if (reduceMotion.matches) return;
        outgoing = previous;
        previous.classList.add('spatial-project-outgoing');
        previous.setAttribute('aria-hidden', 'true');
        container.insertBefore(previous, next.nextSibling);
        const distance = container.getBoundingClientRect().width;
        const timing = { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
        next.animate([{ transform: `translateX(${direction * distance}px)` }, { transform: 'translateX(0)' }], timing);
        previous.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-direction * distance}px)` }],
          { ...timing, fill: 'forwards' }).finished.then(() => previous.remove(), () => previous.remove());
      };
      const directionAt = (event) => {
        const bounds = container.getBoundingClientRect();
        return event.clientX < bounds.left + bounds.width / 2 ? -1 : 1;
      };
      container.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'touch') container.dataset.cursorDirection = directionAt(event) < 0 ? 'previous' : 'next';
      });
      container.addEventListener('click', (event) => { event.stopPropagation(); move(directionAt(event)); });
      container.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      });
      updateCounter();
      container.appendChild(counter);
    }
    if (mobileSpatialCatalogue) {
      const mobileIntro = document.createElement('p');
      mobileIntro.className = 'mobile-spatial-intro-copy';
      mobileIntro.textContent = 'I’m a freelance graphic designer based in Copenhagen, mainly working with visual identities, editorial design, typography, print and digital experiences. Using structure, systems and expressive type, I build distinct visual worlds. For collaborations or more info: mtsalkos@hotmail.com.';
      mobileSpatialCatalogue.appendChild(mobileIntro);

      const curatedProjects = projects
        .filter((project) => project.hasAttribute('data-curated'))
        .sort((a, b) => Number(b.dataset.yearSort) - Number(a.dataset.yearSort));

      curatedProjects.forEach((project) => {
        let slideshowImages = quickViewImages(project);
        const videoSource = project.dataset.previewVideo;
        let source = videoSource || slideshowImages[0];
        if (project === nightJourneysProject) {
          const nightJourneyRows = [...project.querySelectorAll('.list-dropdown-row[data-quick-view]')];
          const firstNightJourney = nightJourneyRows[0];
          source = firstNightJourney
            ? firstNightJourney.dataset.spatialImage || quickViewImages(firstNightJourney)[0]
            : '';
          slideshowImages = nightJourneyRows
            .map((row) => row.dataset.spatialImage || quickViewImages(row)[0])
            .filter(Boolean);
        }
        if (!source) return;

        const listCells = project.querySelectorAll('.list-row > span');
        const year = listCells[0]?.textContent.trim() || '';
        const titleCell = listCells[1];
        const lightName = titleCell?.querySelector('.theme-label-light')?.textContent.trim()
          || titleCell?.textContent.trim()
          || project.dataset.displayType?.split('|').filter(Boolean).join(' ')
          || '';
        const darkName = titleCell?.querySelector('.theme-label-dark')?.textContent.trim()
          || project.dataset.darkDisplayType?.split('|').filter(Boolean).join(' ')
          || lightName;
        const name = lightName;
        const item = document.createElement('figure');
        item.className = 'mobile-spatial-catalogue-item';
        item.dataset.displayType = project.dataset.displayType || '';
        if (videoSource) item.dataset.previewVideo = videoSource;
        item.dataset.slideshowIndex = String(mobileSlideshows.length);
        item.dataset.slideshowImageIndex = String(Math.max(0, slideshowImages.indexOf(source)));
        if (project === nightJourneysProject) {
          project.dataset.slideshowIndex = String(mobileSlideshows.length);
        }
        const itemImages = slideshowImages.length ? slideshowImages : videoSource ? [] : [source];
        mobileSlideshows.push({
          name,
          images: itemImages,
          video: videoSource
        });

        const imageStage = document.createElement('span');
        imageStage.className = 'mobile-spatial-catalogue-image';
        const image = videoSource ? createPreviewVideo(videoSource, name) : document.createElement('img');
        if (!videoSource) {
          image.src = source;
          image.alt = '';
          image.loading = 'lazy';
          image.decoding = 'async';
        }
        imageStage.appendChild(image);
        if (videoSource && itemImages.length) mountVideoSlides(imageStage, image, videoSource, itemImages, name);
        let mobileProjectWidthFrame = null;
        const syncMobileProjectWidth = () => {
          mobileProjectWidthFrame = null;
          const width = image.getBoundingClientRect().width;
          if (width > 0) {
            item.style.setProperty('--mobile-project-width', `${width}px`);
          }
        };
        const queueMobileProjectWidth = () => {
          if (!mobileViewport.matches) return;
          if (mobileProjectWidthFrame !== null) return;
          mobileProjectWidthFrame = window.requestAnimationFrame(syncMobileProjectWidth);
        };
        image.addEventListener(videoSource ? 'loadedmetadata' : 'load', queueMobileProjectWidth);
        window.addEventListener('resize', queueMobileProjectWidth);
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', queueMobileProjectWidth);
        }
        queueMobileProjectWidth();

        if (!videoSource && itemImages.length > 1) {
          let previewIndex = Math.max(0, itemImages.indexOf(source));
          const previewTrack = document.createElement('span');
          previewTrack.className = 'mobile-spatial-preview-track';
          const createPreviewSlide = (previewImage) => {
            const slide = document.createElement('span');
            slide.className = 'mobile-spatial-preview-slide';
            slide.appendChild(previewImage);
            return slide;
          };
          const createPreviewImage = () => {
            const previewImage = document.createElement('img');
            previewImage.alt = '';
            previewImage.loading = 'lazy';
            previewImage.decoding = 'async';
            return previewImage;
          };
          const previousImage = createPreviewImage();
          const nextImage = createPreviewImage();
          image.classList.add('mobile-spatial-preview-current-image');
          previewTrack.append(
            createPreviewSlide(previousImage),
            createPreviewSlide(image),
            createPreviewSlide(nextImage)
          );
          imageStage.replaceChildren(previewTrack);
          const previewSlideDistance = () => {
            const gap = Number.parseFloat(window.getComputedStyle(previewTrack).columnGap) || 0;
            return imageStage.clientWidth + gap;
          };
          const updatePreviewImage = () => {
            previousImage.src = itemImages[(previewIndex - 1 + itemImages.length) % itemImages.length];
            image.src = itemImages[previewIndex];
            nextImage.src = itemImages[(previewIndex + 1) % itemImages.length];
            item.dataset.slideshowImageIndex = String(previewIndex);
            queueMobileProjectWidth();
          };
          const movePreviewImage = (direction) => {
            previewIndex = (previewIndex + direction + itemImages.length) % itemImages.length;
            updatePreviewImage();
          };
          const slidePreviewImage = (direction, distance = imageStage.clientWidth || window.innerWidth) => {
            if (imageStage.dataset.isAnimating === 'true') return;
            const slideDirection = direction < 0 ? -1 : 1;
            imageStage.dataset.isAnimating = 'true';
            imageStage.classList.remove('is-dragging');
            imageStage.style.setProperty('--mobile-preview-x', `${slideDirection * distance}px`);

            window.setTimeout(() => {
              movePreviewImage(slideDirection < 0 ? 1 : -1);
              imageStage.classList.add('is-dragging');
              imageStage.style.setProperty('--mobile-preview-x', '0px');
              window.requestAnimationFrame(() => {
                imageStage.classList.remove('is-dragging');
                delete imageStage.dataset.isAnimating;
              });
            }, reduceMotion.matches ? 0 : 180);
          };
          if (!mobileViewport.matches) {
            const previousButton = document.createElement('button');
            previousButton.className = 'mobile-spatial-preview-arrow mobile-spatial-preview-previous';
            previousButton.type = 'button';
            previousButton.setAttribute('aria-label', `Previous ${name} image`);

            const nextButton = document.createElement('button');
            nextButton.className = 'mobile-spatial-preview-arrow mobile-spatial-preview-next';
            nextButton.type = 'button';
            nextButton.setAttribute('aria-label', `Next ${name} image`);

            previousButton.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              slidePreviewImage(1, previewSlideDistance());
            });

            nextButton.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              slidePreviewImage(-1, previewSlideDistance());
            });

            imageStage.addEventListener('click', (event) => {
              if (event.target.closest('.mobile-spatial-preview-arrow')) return;
              const rect = imageStage.getBoundingClientRect();
              const direction = event.clientX < rect.left + rect.width / 2 ? -1 : 1;
              slidePreviewImage(direction < 0 ? 1 : -1, previewSlideDistance());
            });

            imageStage.append(previousButton, nextButton);
          }

          let touchStartX = 0;
          let touchStartY = 0;
          let touchMoved = false;

          imageStage.addEventListener('touchstart', (event) => {
            if (event.touches.length !== 1) return;
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            touchMoved = false;
          }, { passive: true });

          imageStage.addEventListener('touchmove', (event) => {
            if (imageStage.dataset.isAnimating === 'true') return;
            if (event.touches.length !== 1) return;
            const deltaX = event.touches[0].clientX - touchStartX;
            const deltaY = event.touches[0].clientY - touchStartY;
            if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
              touchMoved = true;
              event.preventDefault();
              imageStage.classList.add('is-dragging');
              imageStage.style.setProperty('--mobile-preview-x', `${deltaX}px`);
            }
          }, { passive: false });

          imageStage.addEventListener('touchend', (event) => {
            imageStage.classList.remove('is-dragging');
            if (!touchMoved || !event.changedTouches.length) {
              imageStage.style.setProperty('--mobile-preview-x', '0px');
              return;
            }
            const deltaX = event.changedTouches[0].clientX - touchStartX;
            const deltaY = event.changedTouches[0].clientY - touchStartY;
            if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
              imageStage.style.setProperty('--mobile-preview-x', '0px');
              return;
            }
            slidePreviewImage(deltaX, previewSlideDistance());
          });

          imageStage.addEventListener('touchcancel', () => {
            imageStage.classList.remove('is-dragging');
            imageStage.style.setProperty('--mobile-preview-x', '0px');
          });
          updatePreviewImage();

        }

        const caption = document.createElement('figcaption');
        if (darkName !== lightName) {
          if (year) caption.append(`${year} `);
          const lightLabel = document.createElement('span');
          lightLabel.className = 'theme-label theme-label-light';
          lightLabel.textContent = lightName;
          const darkLabel = document.createElement('span');
          darkLabel.className = 'theme-label theme-label-dark';
          darkLabel.textContent = darkName;
          caption.append(lightLabel, darkLabel);
        } else {
          caption.textContent = year ? `${year} ${name}` : name;
        }
        item.append(imageStage, caption);
        mobileSpatialCatalogue.appendChild(item);
      });

    }

    // A single cover per project; rows follow a repeating four-column rhythm.
    const spatialProjectGrid = document.createElement('section');
    spatialProjectGrid.className = 'spatial-project-grid';
    spatialProjectGrid.setAttribute('aria-label', 'Selected projects');
    const spatialRowLayouts = [[2, 2], [3, 1], [4], [1, 3]];
    const spatialCovers = [...mobileSpatialCatalogue?.querySelectorAll('.mobile-spatial-catalogue-item') || []];
    // Keep the established opening pairs together as new projects are added.
    const openingProjects = ['Night|Journeys|', 'O Days|Volunteer|Merchandise', 'Houndstooth||', 'God I Love|Football|'];
    const openingRank = (item) => {
      const index = openingProjects.indexOf(item.dataset.displayType);
      return index < 0 ? openingProjects.length : index;
    };
    spatialCovers.sort((a, b) => openingRank(a) - openingRank(b));
    let spatialCoverIndex = 0;
    let spatialRowIndex = 0;
    const containedCoverStart = spatialCovers.findIndex((item) => item.dataset.displayType === 'Houndstooth||');
    while (spatialCoverIndex < spatialCovers.length) {
      const row = document.createElement('div');
      row.className = 'spatial-project-row';
      const isHoundstoothFootballRow = spatialCovers[spatialCoverIndex]?.dataset.displayType === 'Houndstooth||'
        && spatialCovers[spatialCoverIndex + 1]?.dataset.displayType === 'God I Love|Football|';
      const isHomeShirtVideoRow = spatialCovers[spatialCoverIndex]?.dataset.displayType === 'Home|Shirt|24/25'
        && spatialCovers[spatialCoverIndex + 1]?.dataset.displayType === 'AllezAllez||';
      const layout = isHomeShirtVideoRow ? [3, 1]
        : isHoundstoothFootballRow ? [2, 2] : spatialRowLayouts[spatialRowIndex % spatialRowLayouts.length];
      const remaining = spatialCovers.length - spatialCoverIndex;
      const spans = remaining === 1 ? [4] : layout;
      spans.forEach((span) => {
        const sourceItem = spatialCovers[spatialCoverIndex++];
        const cover = document.createElement('div');
        cover.className = 'spatial-project-cover';
        cover.style.setProperty('--project-columns', span);
        cover.dataset.displayType = sourceItem.dataset.displayType;
        const slideshowIndex = Number(sourceItem.dataset.slideshowIndex);
        const frameSlideshow = mobileSlideshows[slideshowIndex];
        const useContainedImage = cover.dataset.displayType === 'Night|Journeys|'
          || (containedCoverStart >= 0 && spatialCoverIndex - 1 >= containedCoverStart
            && cover.dataset.displayType !== 'A Pattern|Language|');
        cover.classList.toggle('spatial-project-contained', useContainedImage && (!frameSlideshow.video || frameSlideshow.images.length > 0));
        let frameImageIndex = Number(sourceItem.dataset.slideshowImageIndex) || 0;
        cover.setAttribute('role', 'group');
        cover.setAttribute('aria-roledescription', frameSlideshow.video ? 'video preview' : 'slideshow');
        cover.setAttribute('aria-label', frameSlideshow.name);
        const image = frameSlideshow.video ? createPreviewVideo(frameSlideshow.video, frameSlideshow.name) : document.createElement('img');
        if (frameSlideshow.video) {
          cover.classList.add('spatial-project-video');
        } else {
          image.src = frameSlideshow.images[frameImageIndex];
          image.alt = `${frameSlideshow.name}, image ${frameImageIndex + 1} of ${frameSlideshow.images.length}`;
          image.loading = 'lazy';
          if (spatialCoverIndex <= 2) image.fetchPriority = 'high';
          image.decoding = 'async';
          image.draggable = false;
        }
        const caption = document.createElement('span');
        caption.className = 'spatial-project-caption';
        caption.append(...sourceItem.querySelector('figcaption').cloneNode(true).childNodes);
        cover.append(image, caption);
        if (frameSlideshow.video && frameSlideshow.images.length) {
          mountVideoSlides(cover, image, frameSlideshow.video, frameSlideshow.images, frameSlideshow.name);
        }
        if (!frameSlideshow.video && frameSlideshow.images.length > 1) {
          const isNightJourneys = cover.dataset.displayType === 'Night|Journeys|';
          const isODays = cover.dataset.displayType === 'O Days|Volunteer|Merchandise';
          const hasAutoplay = isNightJourneys || isODays;
          const frameDirection = (event) => {
            const bounds = cover.getBoundingClientRect();
            return event.clientX < bounds.left + bounds.width / 2 ? -1 : 1;
          };
          cover.dataset.cursorDirection = 'next';
          cover.addEventListener('pointermove', (event) => {
            if (event.pointerType === 'touch') return;
            cover.dataset.cursorDirection = frameDirection(event) < 0 ? 'previous' : 'next';
          });
          const counter = document.createElement('span');
          counter.className = 'spatial-project-counter';
          counter.setAttribute('aria-live', 'polite');
          const updateCounter = () => {
            counter.textContent = `${frameImageIndex + 1} / ${frameSlideshow.images.length}`;
          };
          let frameLoadId = 0;
          let outgoingImage = null;
          const moveFrame = async (direction) => {
            const nextIndex = (frameImageIndex + direction + frameSlideshow.images.length) % frameSlideshow.images.length;
            const loadId = ++frameLoadId;
            const preload = new Image();
            preload.decoding = 'async';
            preload.src = frameSlideshow.images[nextIndex];
            try {
              await preload.decode();
            } catch {
              return;
            }
            if (loadId !== frameLoadId || document.body.classList.contains('list-view') || mobileViewport.matches) return;
            outgoingImage?.getAnimations().forEach((animation) => animation.cancel());
            outgoingImage?.remove();
            image.getAnimations().forEach((animation) => animation.cancel());
            let outgoing = null;
            if (!reduceMotion.matches) {
              outgoing = image.cloneNode();
              outgoing.alt = '';
              outgoing.setAttribute('aria-hidden', 'true');
              outgoing.className = 'spatial-project-outgoing';
              cover.insertBefore(outgoing, caption);
              outgoingImage = outgoing;
            }
            frameImageIndex = nextIndex;
            image.src = frameSlideshow.images[frameImageIndex];
            image.alt = `${frameSlideshow.name}, image ${frameImageIndex + 1} of ${frameSlideshow.images.length}`;
            updateCounter();
            if (outgoing) {
              const distance = cover.getBoundingClientRect().width;
              const timing = { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
              image.animate([
                { transform: `translateX(${direction * distance}px)` },
                { transform: 'translateX(0)' }
              ], timing);
              outgoing.animate([
                { transform: 'translateX(0)' },
                { transform: `translateX(${-direction * distance}px)` }
              ], { ...timing, fill: 'forwards' }).finished.then(() => outgoing.remove(), () => outgoing.remove());
            }
          };
          if (hasAutoplay) {
            counter.setAttribute('aria-live', 'off');
            let autoplayTimer = null;
            let idleTimer = null;
            const pauseAutoplay = () => {
              window.clearInterval(autoplayTimer);
              window.clearTimeout(idleTimer);
              autoplayTimer = null;
              // Cancel an automatic image that is still loading.
              frameLoadId++;
            };
            const advanceAutoplay = () => {
              if (document.hidden || document.body.classList.contains('list-view') || mobileViewport.matches) return;
              const bounds = cover.getBoundingClientRect();
              if (bounds.bottom > 0 && bounds.top < window.innerHeight) moveFrame(1);
            };
            const resumeAutoplay = () => {
              window.clearInterval(autoplayTimer);
              window.clearTimeout(idleTimer);
              autoplayTimer = window.setInterval(advanceAutoplay, 2000);
            };
            const pauseUntilIdle = () => {
              pauseAutoplay();
              idleTimer = window.setTimeout(() => {
                advanceAutoplay();
                resumeAutoplay();
              }, 2000);
            };
            cover.addEventListener('pointerenter', pauseUntilIdle);
            cover.addEventListener('pointermove', pauseUntilIdle);
            cover.addEventListener('click', pauseUntilIdle);
            cover.addEventListener('keydown', (event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') pauseUntilIdle();
            });
            cover.addEventListener('pointerleave', resumeAutoplay);
            resumeAutoplay();
          }
          cover.addEventListener('click', (event) => {
            moveFrame(frameDirection(event));
          });
          cover.tabIndex = 0;
          cover.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            moveFrame(event.key === 'ArrowLeft' ? -1 : 1);
          });
          updateCounter();
          cover.appendChild(counter);
        }
        row.appendChild(cover);
      });
      if (spans.length === 2) {
        row.classList.add('is-resizable');
        const divider = document.createElement('div');
        divider.className = 'spatial-project-divider';
        divider.tabIndex = 0;
        divider.setAttribute('role', 'separator');
        divider.setAttribute('aria-orientation', 'vertical');
        divider.setAttribute('aria-label', 'Resize project frames');
        divider.setAttribute('aria-valuemin', '20');
        divider.setAttribute('aria-valuemax', '80');
        let split = spans[0] * 25;
        const setSplit = (value) => {
          split = Math.max(20, Math.min(80, value));
          row.style.setProperty('--frame-split', `${split}%`);
          divider.setAttribute('aria-valuenow', String(Math.round(split)));
          divider.setAttribute('aria-valuetext', `${Math.round(split)}% left, ${Math.round(100 - split)}% right`);
        };
        setSplit(split);
        let dragPointer = null;
        const resizeFromPointer = (event) => {
          const bounds = row.getBoundingClientRect();
          if (bounds.width) setSplit((event.clientX - bounds.left) / bounds.width * 100);
        };
        const stopResizing = () => {
          dragPointer = null;
          row.classList.remove('is-resizing');
          document.body.classList.remove('is-resizing-frames');
        };
        divider.addEventListener('pointerdown', (event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          dragPointer = event.pointerId;
          divider.setPointerCapture(dragPointer);
          divider.focus({ preventScroll: true });
          row.classList.add('is-resizing');
          document.body.classList.add('is-resizing-frames');
          resizeFromPointer(event);
        });
        divider.addEventListener('pointermove', (event) => {
          if (event.pointerId === dragPointer) resizeFromPointer(event);
        });
        divider.addEventListener('pointerup', (event) => {
          if (event.pointerId !== dragPointer) return;
          resizeFromPointer(event);
          divider.releasePointerCapture(event.pointerId);
          stopResizing();
        });
        divider.addEventListener('pointercancel', stopResizing);
        divider.addEventListener('lostpointercapture', stopResizing);
        divider.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          setSplit(event.key === 'Home' ? 20 : event.key === 'End' ? 80 : split + (event.key === 'ArrowLeft' ? -2 : 2));
        });
        row.appendChild(divider);
      }
      spatialProjectGrid.appendChild(row);
      spatialRowIndex++;
    }
    workGrid.appendChild(spatialProjectGrid);

    if (!reduceMotion.matches) {
      const revealGroups = new WeakMap();
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealGroups.get(entry.target)?.forEach((card) => card.classList.add('is-revealed'));
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
      const prepareReveal = (target, cards) => {
        cards.forEach((card, index) => {
          card.style.setProperty('--reveal-delay', `${index * 90}ms`);
          card.style.setProperty('--reveal-tilt', `${index % 2 ? 1.25 : -1.25}deg`);
          card.classList.add('project-scroll-reveal');
        });
        revealGroups.set(target, cards);
        revealObserver.observe(target);
      };
      [...spatialProjectGrid.querySelectorAll('.spatial-project-row')].slice(1).forEach((row) => {
        row.classList.add('is-scroll-reveal-row');
        prepareReveal(row, [...row.querySelectorAll('.spatial-project-cover')]);
      });
      [...mobileSpatialCatalogue?.querySelectorAll('.mobile-spatial-catalogue-item') || []].slice(2).forEach((item) => {
        prepareReveal(item, [item]);
      });
    }

    projects.forEach((project) => {
      if (project.hasAttribute('data-list-dropdown')) return;
      const listRow = project.querySelector(':scope > .list-row');
      if (!listRow) return;

      const cells = Array.from(listRow.children).map((cell) => cell.textContent.trim());
      const [year = '', name = 'Project', client = '', format = ''] = cells;
      const images = quickViewImages(project);
      project.dataset.listDropdown = '';
      project.setAttribute('aria-expanded', 'false');

      const dropdown = document.createElement('span');
      dropdown.className = 'list-dropdown list-dropdown-media';

      const row = document.createElement('span');
      row.className = images.length || project.dataset.previewVideo
        ? 'list-dropdown-row list-dropdown-media-row list-dropdown-generated-row'
        : 'list-dropdown-row list-dropdown-media-row list-dropdown-text-only-row list-dropdown-generated-row';
      if (project.dataset.displayType === 'God I Love|Football|') {
        row.classList.add('list-dropdown-god-football-row');
      }

      const copy = document.createElement('span');
      copy.className = 'list-dropdown-copy list-dropdown-copy-static';

      const descriptionTitle = document.createElement('strong');
      descriptionTitle.className = 'list-dropdown-copy-title';
      descriptionTitle.textContent = 'Description';

      const description = document.createElement('span');
      description.className = 'list-dropdown-copy-description';
      description.textContent = project.dataset.description || `${name} is a ${format || 'project'} for ${client || 'Self-Initiated'}.`;
      if (project.dataset.projectUrl && format) {
        const text = description.textContent;
        const linkStart = text.toLowerCase().indexOf(format.toLowerCase());
        if (linkStart >= 0) {
          const link = document.createElement('a');
          link.href = project.dataset.projectUrl;
          link.textContent = text.slice(linkStart, linkStart + format.length);
          description.replaceChildren(text.slice(0, linkStart), link, text.slice(linkStart + format.length));
        }
      }

      const detailsTitle = document.createElement('strong');
      detailsTitle.className = 'list-dropdown-copy-title list-dropdown-details-title';
      detailsTitle.textContent = 'Details';

      const designers = document.createDocumentFragment();
      designers.append('Michael Tsalkos');
      if (project.dataset.coDesigner) {
        const collaborator = document.createElement('a');
        collaborator.textContent = project.dataset.coDesigner;
        collaborator.href = project.dataset.coDesignerUrl;
        designers.append(document.createElement('br'), collaborator);
      }
      const details = [
        ['Year', year],
        ['Client', client],
        ['Format', format],
        [project.dataset.coDesigner ? 'Designer(s)' : 'Designer', designers]
      ];

      copy.append(descriptionTitle, description, detailsTitle);
      details.forEach(([label, value]) => {
        if (!value) return;
        const detail = document.createElement('span');
        detail.className = 'list-dropdown-detail';
        detail.append(`${label}:`, document.createElement('br'), value);
        copy.appendChild(detail);
      });

      if (project.dataset.essay) {
        const essay = document.createElement('span');
        essay.className = 'list-dropdown-essay';
        project.dataset.essay.split(/\n{2,}/).forEach((paragraph) => {
          const text = paragraph.trim();
          if (!text) return;
          const paragraphElement = document.createElement('span');
          paragraphElement.textContent = text;
          essay.appendChild(paragraphElement);
        });
        copy.appendChild(essay);
      }

      row.appendChild(copy);

      if (project.dataset.previewVideo) {
        const gallery = document.createElement('span');
        gallery.className = 'list-dropdown-gallery list-dropdown-gallery-video';
        gallery.appendChild(createPreviewVideo(project.dataset.previewVideo, name));
        row.appendChild(gallery);
      }

      if (images.length) {
        const gallery = document.createElement('span');
        gallery.className = 'list-dropdown-gallery';
        if (project.dataset.dropdownGallery === 'full') {
          gallery.classList.add('list-dropdown-gallery-full');
        }
        if (project.dataset.dropdownGallery === 'columns-2-3') {
          gallery.classList.add('list-dropdown-gallery-columns-2-3');
        }
        if (project.dataset.displayType === 'God I Love|Football|') {
          gallery.classList.add('list-dropdown-gallery-god-football');
        }
        images.forEach((source, index) => {
          const image = document.createElement('img');
          image.src = source;
          image.alt = `${name} project image`;
          image.loading = 'lazy';
          if (project.dataset.displayType === 'God I Love|Football|') {
            image.className = `god-football-image god-football-image-${index + 1}`;
          }
          gallery.appendChild(image);
        });
        row.appendChild(gallery);
      }

      dropdown.appendChild(row);
      project.appendChild(dropdown);
    });

    const allPreview = document.createElement('section');
    allPreview.className = 'all-project-preview';
    allPreview.setAttribute('aria-label', 'Project preview');
    allPreview.innerHTML = '<h2 class="all-preview-heading"></h2><div class="all-preview-content"><div class="all-preview-copy"></div><div class="all-preview-media"></div></div>';
    document.body.appendChild(allPreview);
    const allPreviewHeading = allPreview.querySelector('.all-preview-heading');
    const allPreviewCopy = allPreview.querySelector('.all-preview-copy');
    const allPreviewMedia = allPreview.querySelector('.all-preview-media');
    allPreviewCopy.id = 'all-project-details';
    let activeAllSource = null;
    let allPreviewImages = [];
    let allPreviewIndex = 0;
    let allPreviewLoadId = 0;
    let allPreviewPointer = null;
    let suppressAllHover = false;
    allPreviewMedia.setAttribute('role', 'group');
    allPreviewMedia.setAttribute('aria-label', 'Project preview. Left and Right browse images; Up and Down browse projects.');

    function setAllDetailsOpen(open) {
      allPreview.classList.toggle('is-details-open', open);
      allPreviewCopy.inert = !open;
      allPreviewCopy.setAttribute('aria-hidden', String(!open));
      const activeProject = activeAllSource?.closest('.project');
      projects.forEach((project) => {
        project.querySelector('.all-read-more')?.setAttribute('aria-expanded', String(open && project === activeProject));
      });
    }

    projects.forEach((project) => {
      const formatCell = project.querySelector(':scope > .list-row > span:nth-child(4)');
      if (!formatCell) return;
      const formatLabel = document.createElement('span');
      formatLabel.className = 'all-format-label';
      formatLabel.append(...formatCell.childNodes);
      const readMore = document.createElement('button');
      readMore.type = 'button';
      readMore.className = 'all-read-more';
      readMore.textContent = 'read more about this project';
      readMore.setAttribute('aria-controls', allPreviewCopy.id);
      readMore.setAttribute('aria-expanded', 'false');
      readMore.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showAllPreview(project);
        setAllDetailsOpen(!allPreview.classList.contains('is-details-open'));
      });
      formatCell.append(formatLabel, readMore);
    });
    setAllDetailsOpen(false);

    function moveAllPreview(direction) {
      if (allPreviewMedia.dataset.canBrowse !== 'true') return;
      allPreviewIndex = (allPreviewIndex + direction + allPreviewImages.length) % allPreviewImages.length;
      renderAllPreviewMedia(direction, 'horizontal');
    }

    function allPreviewDirection(event) {
      const bounds = allPreviewMedia.getBoundingClientRect();
      const edgeSize = Math.min(24, bounds.height * 0.08);
      if (event.clientY < bounds.top + edgeSize) return 'up';
      if (event.clientY > bounds.bottom - edgeSize) return 'down';
      if (allPreviewMedia.dataset.canBrowse !== 'true') return null;
      return event.clientX < bounds.left + bounds.width / 2 ? 'previous' : 'next';
    }

    function updateAllPreviewCursor(event) {
      const direction = allPreviewDirection(event);
      if (direction) allPreviewMedia.dataset.cursorDirection = direction;
      else delete allPreviewMedia.dataset.cursorDirection;
    }

    function moveAllProject(direction) {
      const ordered = [...workGrid.querySelectorAll(':scope > .project')];
      const index = ordered.indexOf(activeAllSource?.closest('.project'));
      const target = ordered[Math.max(0, Math.min(ordered.length - 1, index + direction))];
      if (!target || target === activeAllSource?.closest('.project')) return;
      suppressAllHover = true;
      showAllPreview(target);
      target.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    allPreviewMedia.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      allPreviewPointer = { clientX: event.clientX, clientY: event.clientY };
      updateAllPreviewCursor(event);
    });
    allPreviewMedia.addEventListener('pointerleave', () => {
      allPreviewPointer = null;
      delete allPreviewMedia.dataset.cursorDirection;
    });
    allPreviewMedia.addEventListener('click', (event) => {
      const direction = allPreviewDirection(event);
      if (direction === 'up' || direction === 'down') moveAllProject(direction === 'up' ? -1 : 1);
      else if (direction) moveAllPreview(direction === 'previous' ? -1 : 1);
    });
    let previewWheelTime = 0;
    let previewWheelDelta = 0;
    let previewWheelConsumed = false;
    allPreviewMedia.addEventListener('wheel', (event) => {
      if (!document.body.classList.contains('list-view') || event.ctrlKey
        || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      const now = performance.now();
      // Treat a trackpad gesture and its momentum as one project change.
      if (now - previewWheelTime > 180) {
        previewWheelDelta = 0;
        previewWheelConsumed = false;
      }
      previewWheelTime = now;
      if (previewWheelConsumed) return;
      const unit = event.deltaMode === 1 ? 16
        : event.deltaMode === 2 ? allPreviewMedia.clientHeight : 1;
      previewWheelDelta += event.deltaY * unit;
      if (Math.abs(previewWheelDelta) < 40) return;
      previewWheelConsumed = true;
      moveAllProject(previewWheelDelta > 0 ? 1 : -1);
    }, { passive: false });
    allPreviewMedia.addEventListener('keydown', (event) => {
      if (allPreviewMedia.dataset.canBrowse !== 'true' || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      moveAllPreview(event.key === 'ArrowLeft' ? -1 : 1);
    });
    window.addEventListener('keydown', (event) => {
      if (!document.body.classList.contains('list-view') || document.body.classList.contains('spatial-slideshow-open') || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!['ArrowUp', 'ArrowDown'].includes(event.key) || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      moveAllProject(event.key === 'ArrowUp' ? -1 : 1);
    });

    async function renderAllPreviewMedia(direction = 1, motion = 'vertical') {
      const loadId = ++allPreviewLoadId;
      const source = allPreviewImages[allPreviewIndex];
      const name = allPreviewHeading.textContent;
      const index = allPreviewIndex;
      const count = allPreviewImages.length;
      const canBrowse = source && allPreviewImages.length > 1;
      allPreviewMedia.tabIndex = 0;
      allPreviewMedia.dataset.canBrowse = String(Boolean(canBrowse));
      if (allPreviewPointer) updateAllPreviewCursor(allPreviewPointer);
      else if (canBrowse) allPreviewMedia.dataset.cursorDirection = 'next';
      else delete allPreviewMedia.dataset.cursorDirection;
      if (!source) {
        allPreviewMedia.querySelectorAll('video').forEach((video) => {
          video.pause();
          previewVideoObserver.unobserve(video);
        });
        allPreviewMedia.replaceChildren();
        return;
      }
      const isVideo = /\.(mp4|mov|webm)(?:\?|$)/i.test(source);
      const media = isVideo ? createPreviewVideo(source, name, { eager: true }) : document.createElement('img');
      if (isVideo) {
        media.preload = 'auto';
        await new Promise((resolve) => {
          media.addEventListener('loadeddata', resolve, { once: true });
          media.addEventListener('error', resolve, { once: true });
          media.load();
        });
      } else {
        media.src = source;
        media.alt = `${name}, image ${index + 1} of ${count}`;
        media.decoding = 'async';
        media.draggable = false;
        await media.decode().catch(() => {});
      }
      if (loadId !== allPreviewLoadId || !document.body.classList.contains('list-view')) {
        if (isVideo) {
          media.pause();
          previewVideoObserver.unobserve(media);
        }
        return;
      }
      const outgoing = !reduceMotion.matches
        ? allPreviewMedia.querySelector('img:not(.all-preview-outgoing), video:not(.all-preview-outgoing)')
        : null;
      outgoing?.getAnimations().forEach((animation) => animation.cancel());
      allPreviewMedia.querySelectorAll('video').forEach((video) => {
        video.pause();
        previewVideoObserver.unobserve(video);
      });
      allPreviewMedia.replaceChildren(media);
      if (!reduceMotion.matches) {
        const timing = { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
        const axis = motion === 'horizontal' ? 'X' : 'Y';
        media.animate([
          { transform: `translate${axis}(${direction > 0 ? '100%' : '-100%'})`, opacity: 1 },
          { transform: `translate${axis}(0)`, opacity: 1 }
        ], timing);
        if (outgoing) {
          outgoing.classList.add('all-preview-outgoing');
          outgoing.setAttribute('aria-hidden', 'true');
          allPreviewMedia.appendChild(outgoing);
          outgoing.animate([
            { transform: `translate${axis}(0)` },
            { transform: `translate${axis}(${direction > 0 ? '-100%' : '100%'})` }
          ], { ...timing, fill: 'forwards' }).finished.then(() => outgoing.remove(), () => outgoing.remove());
        }
      }
      if (count > 1) {
        const counter = document.createElement('span');
        counter.className = 'all-preview-counter';
        counter.textContent = `${index + 1} / ${count}`;
        allPreviewMedia.appendChild(counter);
      }
    }

    function showAllPreview(source, force = false) {
      if (!document.body.classList.contains('list-view') || (!force && activeAllSource === source)) return;
      const project = source.closest('.project');
      if (!project) return;
      const direction = activeAllSource && (activeAllSource.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_PRECEDING) ? -1 : 1;
      if (force || activeAllSource?.closest('.project') !== project) setAllDetailsOpen(false);
      activeAllSource = source;
      allPreviewIndex = 0;
      allPreviewImages = quickViewImages(source);
      if (!allPreviewImages.length && !source.dataset.previewVideo) {
        allPreviewImages = [...project.querySelectorAll('.list-dropdown-row[data-quick-view]')].flatMap(quickViewImages);
      }
      if (!allPreviewImages.length && !source.dataset.previewVideo) {
        allPreviewImages = [...project.querySelectorAll('.list-dropdown-gallery img, .list-dropdown-gallery-ftf img')]
          .map((image) => image.getAttribute('src')).filter(Boolean);
      }
      if (source.dataset.previewVideo) allPreviewImages.unshift(source.dataset.previewVideo);
      const cells = project.querySelectorAll(':scope > .list-row > span');
      allPreviewHeading.textContent = source === project
        ? cells[1]?.textContent.trim() || 'Project'
        : source.children[1]?.textContent.trim() || cells[1]?.textContent.trim() || 'Project';
      allPreviewCopy.replaceChildren();
      const copy = project.querySelector('.list-dropdown-copy');
      if (copy) allPreviewCopy.appendChild(copy.cloneNode(true));
      else {
        const summary = document.createElement('p');
        summary.textContent = [cells[0]?.textContent, cells[2]?.textContent, cells[3]?.querySelector('.all-format-label')?.textContent || cells[3]?.textContent].filter(Boolean).join(' · ');
        allPreviewCopy.appendChild(summary);
      }
      projects.forEach((item) => item.classList.toggle('is-all-preview-active', item === project));
      renderAllPreviewMedia(direction);
    }

    const previewListTarget = (event) => {
      if (event.type === 'pointerover' && suppressAllHover) return;
      const source = event.target.closest('.list-dropdown-row[data-quick-view], .project');
      if (source) showAllPreview(source);
    };
    workGrid.addEventListener('pointerover', previewListTarget);
    workGrid.addEventListener('pointermove', (event) => {
      if (!suppressAllHover) return;
      suppressAllHover = false;
      previewListTarget(event);
    });
    workGrid.addEventListener('focusin', previewListTarget);

    const slideshow = document.createElement('div');
    slideshow.className = 'spatial-slideshow';
    slideshow.setAttribute('aria-hidden', 'true');
    slideshow.innerHTML = `
      <div class="spatial-slideshow-stage" role="dialog" aria-modal="true" aria-label="Project images">
        <img class="spatial-slideshow-image" alt="" />
        <span class="spatial-slideshow-magnifier" aria-hidden="true"></span>
        <button class="spatial-slideshow-close" type="button" aria-label="Close slideshow"></button>
        <button class="spatial-slideshow-arrow spatial-slideshow-previous" type="button" aria-label="Previous image"></button>
        <button class="spatial-slideshow-arrow spatial-slideshow-next" type="button" aria-label="Next image"></button>
      </div>
    `;
    document.body.appendChild(slideshow);

    const slideshowImage = slideshow.querySelector('.spatial-slideshow-image');
    const slideshowMagnifier = slideshow.querySelector('.spatial-slideshow-magnifier');
    const slideshowClose = slideshow.querySelector('.spatial-slideshow-close');
    const slideshowPrevious = slideshow.querySelector('.spatial-slideshow-previous');
    const slideshowNext = slideshow.querySelector('.spatial-slideshow-next');
    let activeSlideshow = null;
    let activeSlideIndex = 0;
    let isSlideshowMagnifierZoomed = false;

    function renderSlideshow() {
      if (!activeSlideshow) return;
      const hasMultipleImages = activeSlideshow.images.length > 1;
      const source = activeSlideshow.images[activeSlideIndex];
      slideshowImage.alt = `${activeSlideshow.name}, image ${activeSlideIndex + 1} of ${activeSlideshow.images.length}`;
      setProgressImage(slideshowImage, source, {
        onStart: () => slideshow.classList.add('is-loading'),
        onProgress: (progress) => slideshow.style.setProperty('--slideshow-load-progress', `"${progress}%"`),
        onComplete: () => {
          slideshow.classList.remove('is-loading');
          slideshow.style.removeProperty('--slideshow-load-progress');
          slideshowMagnifier.style.backgroundImage = `url("${slideshowImage.currentSrc || slideshowImage.src || source}")`;
        },
        onError: () => {
          slideshow.classList.remove('is-loading');
          slideshow.style.removeProperty('--slideshow-load-progress');
          slideshowMagnifier.style.backgroundImage = `url("${source}")`;
        }
      });
      slideshowMagnifier.classList.remove('is-visible');
      isSlideshowMagnifierZoomed = false;
      slideshowImage.style.cursor = 'zoom-in';
      slideshowPrevious.hidden = !hasMultipleImages;
      slideshowNext.hidden = !hasMultipleImages;
    }

    function openSlideshowData(slideshowData, imageIndex = 0) {
      activeSlideshow = slideshowData;
      if (!activeSlideshow) return;
      activeSlideIndex = Math.max(0, Math.min(imageIndex, activeSlideshow.images.length - 1));
      renderSlideshow();
      slideshow.classList.add('is-open');
      slideshow.setAttribute('aria-hidden', 'false');
      document.body.classList.add('spatial-slideshow-open');
      slideshowClose.focus();
    }

    function openSlideshow(index, imageIndex = 0) {
      openSlideshowData(mobileSlideshows[index], imageIndex);
    }

    function closeSlideshow() {
      slideshow.classList.remove('is-open');
      slideshow.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('spatial-slideshow-open');
      activeSlideshow = null;
      slideshowImage.removeAttribute('src');
      slideshowImage.removeAttribute('data-progress-load-id');
      slideshow.classList.remove('is-loading');
      slideshow.style.removeProperty('--slideshow-load-progress');
      slideshowMagnifier.classList.remove('is-visible');
      slideshowMagnifier.style.backgroundImage = '';
      isSlideshowMagnifierZoomed = false;
      slideshowImage.style.cursor = 'zoom-in';
    }

    function moveSlideshow(direction) {
      if (!activeSlideshow || activeSlideshow.images.length < 2) return;
      activeSlideIndex = (activeSlideIndex + direction + activeSlideshow.images.length) % activeSlideshow.images.length;
      renderSlideshow();
    }

    projects.forEach((project) => {
      if (!project.hasAttribute('data-slideshow-index')) return;
      project.addEventListener('click', (event) => {
        if (document.body.classList.contains('list-view')) return;
        if (window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches) return;
        const clickedImage = event.target.closest('img');
        if (!clickedImage || !project.contains(clickedImage)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const slideshowData = mobileSlideshows[Number(project.dataset.slideshowIndex)];
        let imageIndex = 0;
        if (slideshowData) {
          const clickedUrl = new URL(clickedImage.currentSrc || clickedImage.src, window.location.href).href;
          const matchedIndex = slideshowData.images.findIndex((source) => (
            new URL(source, window.location.href).href === clickedUrl
          ));
          if (matchedIndex >= 0) imageIndex = matchedIndex;
        }
        openSlideshow(Number(project.dataset.slideshowIndex), imageIndex);
      });
    });

    document.querySelectorAll('[data-list-dropdown]').forEach((project) => {
      const dropdownImages = [...project.querySelectorAll('.list-dropdown-gallery img, .list-dropdown-gallery-ftf img')];
      if (!dropdownImages.length) return;

      dropdownImages.forEach((image) => {
        image.addEventListener('click', (event) => {
          if (!document.body.classList.contains('list-view')) return;
          event.preventDefault();
          event.stopPropagation();

          const currentImages = [...project.querySelectorAll('.list-dropdown-gallery img, .list-dropdown-gallery-ftf img')];
          const images = currentImages.map((item) => item.getAttribute('src')).filter(Boolean);
          const imageIndex = Math.max(0, currentImages.indexOf(image));
          const title = project.querySelector('.list-row > span:nth-child(2)')?.textContent.trim() || 'Project';
          openSlideshowData({ name: title, images }, imageIndex);
        });
      });
    });

    slideshowClose.addEventListener('click', closeSlideshow);
    slideshowPrevious.addEventListener('click', () => moveSlideshow(-1));
    slideshowNext.addEventListener('click', () => moveSlideshow(1));
    slideshow.addEventListener('click', (event) => {
      if (event.target === slideshow) closeSlideshow();
    });

    function updateSlideshowMagnifier(event) {
      if (!activeSlideshow || event.pointerType === 'touch') return;
      const rect = slideshowImage.getBoundingClientRect();
      const naturalRatio = slideshowImage.naturalWidth && slideshowImage.naturalHeight
        ? slideshowImage.naturalWidth / slideshowImage.naturalHeight
        : rect.width / rect.height;
      const stageRatio = rect.width / rect.height;
      const renderedWidth = stageRatio > naturalRatio ? rect.height * naturalRatio : rect.width;
      const renderedHeight = stageRatio > naturalRatio ? rect.height : rect.width / naturalRatio;
      const renderedLeft = rect.left + (rect.width - renderedWidth) / 2;
      const renderedTop = rect.top + (rect.height - renderedHeight) / 2;
      const x = event.clientX - renderedLeft;
      const y = event.clientY - renderedTop;
      if (x < 0 || y < 0 || x > renderedWidth || y > renderedHeight) {
        slideshowMagnifier.classList.remove('is-visible');
        return;
      }

      let sampleX = x;
      let sampleY = y;
      let hotspotZoomBoost = 1;
      const currentSource = activeSlideshow.images[activeSlideIndex] || '';
      if (currentSource.includes('Portfolio_QuickView_GODILOVEFOOTBALL_11')) {
        const pointerX = x / renderedWidth;
        const pointerY = y / renderedHeight;
        const manHeadX = 0.595;
        const manHeadY = 0.76;
        const manHeadRadiusX = 0.1;
        const manHeadRadiusY = 0.09;
        const isOverManHead = (
          ((pointerX - manHeadX) / manHeadRadiusX) ** 2
          + ((pointerY - manHeadY) / manHeadRadiusY) ** 2
        ) <= 1;

        if (isOverManHead) {
          sampleX = renderedWidth * 0.3;
          sampleY = renderedHeight * 0.4;
          hotspotZoomBoost = 0.88;
        }
      }

      const zoom = (isSlideshowMagnifierZoomed ? 4.3 : 2.15) * hotspotZoomBoost;
      const lensSize = slideshowMagnifier.offsetWidth || 150;
      const offset = 22;
      slideshowMagnifier.classList.add('is-visible');
      slideshowMagnifier.style.left = `${event.clientX + offset}px`;
      slideshowMagnifier.style.top = `${event.clientY + offset}px`;
      slideshowMagnifier.style.backgroundSize = `${renderedWidth * zoom}px ${renderedHeight * zoom}px`;
      slideshowMagnifier.style.backgroundPosition = `${-(sampleX * zoom - lensSize / 2)}px ${-(sampleY * zoom - lensSize / 2)}px`;
    }

    slideshowImage.addEventListener('pointermove', updateSlideshowMagnifier);

    slideshowImage.addEventListener('click', (event) => {
      if (!activeSlideshow) return;
      event.preventDefault();
      event.stopPropagation();
      isSlideshowMagnifierZoomed = !isSlideshowMagnifierZoomed;
      slideshowImage.style.cursor = isSlideshowMagnifierZoomed ? 'zoom-out' : 'zoom-in';
      updateSlideshowMagnifier(event);
    });

    slideshowImage.addEventListener('pointerleave', () => {
      slideshowMagnifier.classList.remove('is-visible');
    });

    window.addEventListener('keydown', (event) => {
      if (!activeSlideshow) return;
      if (event.key === 'Escape') closeSlideshow();
      if (event.key === 'ArrowLeft') moveSlideshow(-1);
      if (event.key === 'ArrowRight') moveSlideshow(1);
    });

    function positionQuickView(event) {
      if (document.body.classList.contains('list-view')) return;
      const gap = 16;
      const aboveTop = event.clientY - quickView.offsetHeight - gap;
      quickView.style.left = `${event.clientX + gap}px`;
      quickView.style.top = aboveTop < 0
        ? `${event.clientY + gap}px`
        : `${aboveTop}px`;
      quickViewLoader.style.left = quickView.style.left;
      quickViewLoader.style.top = quickView.style.top;
    }

    function showQuickView(project, event) {
      if (document.body.classList.contains('list-view')) {
        if (suppressAllHover) return;
        showAllPreview(project);
        return;
      }
      const images = quickViewImages(project);
      if (
        !images.length ||
        !document.body.classList.contains('list-view') ||
        project.classList.contains('is-dropdown-open')
      ) return;
      activeQuickViewProject = project;
      quickViewIndex = 0;
      setProgressImage(quickView, images[quickViewIndex], {
        onStart: () => {
          quickViewLoader.classList.add('is-visible');
        },
        onProgress: (progress) => {
          quickViewLoader.textContent = `${progress}%`;
        },
        onComplete: () => {
          quickViewLoader.classList.remove('is-visible');
          quickViewLoader.textContent = '';
        },
        onError: () => {
          quickViewLoader.classList.remove('is-visible');
          quickViewLoader.textContent = '';
        }
      });
      quickView.classList.add('is-visible');
      positionQuickView(event);
    }

    function hideQuickView() {
      activeQuickViewProject = null;
      quickView.classList.remove('is-visible');
      quickView.removeAttribute('data-progress-load-id');
      quickViewLoader.classList.remove('is-visible');
      quickViewLoader.textContent = '';
    }

    function updateDisplayTypeForScroll() {
      displayTypeUpdateQueued = false;
      const mobileScrollTop = mobileViewport.matches && !document.body.classList.contains('list-view') && workGrid
        ? workGrid.scrollTop
        : window.scrollY;
      const scrollCueOpacity = Math.max(0, Math.min(1, 1 - mobileScrollTop / 120));
      document.documentElement.style.setProperty('--scroll-cue-opacity', scrollCueOpacity.toFixed(3));

      if (document.body.classList.contains('list-view') || !mobileViewport.matches || !displayTypeProjects.length) {
        document.documentElement.style.setProperty('--selected-opacity', '1');
        displayTypeLayers.forEach(({ layer }) => {
          layer.style.setProperty('--project-opacity', '0');
        });
        return;
      }

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      if (spatialIntro) {
        const introRect = spatialIntro.getBoundingClientRect();
        const introVisibleHeight = Math.max(0, Math.min(viewportHeight, introRect.bottom) - Math.max(0, introRect.top));
        const selectedOpacity = Math.max(0, Math.min(1, introVisibleHeight / viewportHeight));
        document.documentElement.style.setProperty('--selected-opacity', selectedOpacity.toFixed(3));
      }

      displayTypeLayers.forEach((item) => {
        const { project, layer } = item;
        const rect = project.getBoundingClientRect();
        const visibleHeight = Math.max(0, Math.min(viewportHeight, rect.bottom) - Math.max(0, rect.top));
        const opacity = Math.max(0, Math.min(1, visibleHeight / viewportHeight));
        layer.style.setProperty('--project-opacity', opacity.toFixed(3));
      });

      if (oDaysProject) {
        const shirtPair = oDaysProject.querySelector('.o-days-shirt-pair');
        const frontImage = oDaysProject.querySelector('.o-days-shirt-front');
        const backImage = oDaysProject.querySelector('.o-days-shirt-back');
        if (shirtPair && frontImage && backImage) {
          if (!shirtPair.dataset.stickyStart) {
            shirtPair.dataset.stickyStart = String(window.scrollY + shirtPair.getBoundingClientRect().top);
          }
          const stickyStart = Number(shirtPair.dataset.stickyStart);
          const isMobile = window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches;

          if (isMobile) {
            const rotationStart = stickyStart + viewportHeight * 0.35;
            const rotationProgress = Math.max(0, Math.min(1, (window.scrollY - rotationStart) / (viewportHeight * 0.9)));
            const easedRotation = rotationProgress * rotationProgress * (3 - 2 * rotationProgress);
            frontImage.style.removeProperty('--o-days-front-size');
            frontImage.style.setProperty('--o-days-shirt-shift', '0px');
            frontImage.style.setProperty('--o-days-shirt-lift', '0px');
            frontImage.style.setProperty('--o-days-shirt-spin-x', '0deg');
            frontImage.style.setProperty('--o-days-shirt-spin-y', `${(180 * easedRotation).toFixed(2)}deg`);
            backImage.style.setProperty('--o-days-shirt-shift', '0px');
            backImage.style.setProperty('--o-days-shirt-lift', '0px');
            backImage.style.setProperty('--o-days-shirt-spin-x', '0deg');
            backImage.style.setProperty('--o-days-shirt-spin-y', '0deg');
            shirtPair.style.setProperty('--o-days-back-visibility', 'hidden');
          } else {
            const zoomProgress = Math.max(0, Math.min(1, (window.scrollY - stickyStart) / (viewportHeight * 0.4)));
            const easedZoom = zoomProgress * zoomProgress * (3 - 2 * zoomProgress);
            const baseSize = backImage.offsetWidth;
            const coverSize = Math.max(window.innerWidth, viewportHeight);
            const frontSize = coverSize + (baseSize - coverSize) * easedZoom;
            frontImage.style.setProperty('--o-days-front-size', `${frontSize.toFixed(2)}px`);

            const splitStart = stickyStart + viewportHeight * 0.8;
            const splitProgress = Math.max(0, Math.min(1, (window.scrollY - splitStart) / (viewportHeight * 0.65)));
            const easedSplit = splitProgress * splitProgress * (3 - 2 * splitProgress);
            const shift = window.innerWidth * 0.25 * easedSplit;
            const smallSpinStart = splitStart + viewportHeight * 0.65;
            const smallSpinProgress = Math.max(0, Math.min(1, (window.scrollY - smallSpinStart) / (viewportHeight * 0.35)));
            const smallSpin = 28 * smallSpinProgress;
            const exitStart = smallSpinStart + viewportHeight * 0.65;
            const exitProgress = Math.max(0, Math.min(1, (window.scrollY - exitStart) / (viewportHeight * 0.8)));
            const easedExit = exitProgress * exitProgress * (3 - 2 * exitProgress);
            const spinY = smallSpin + 360 * easedExit;
            const spinX = 360 * easedExit;
            const lift = -viewportHeight * 1.15 * easedExit;
            frontImage.style.setProperty('--o-days-shirt-shift', `${-shift.toFixed(2)}px`);
            backImage.style.setProperty('--o-days-shirt-shift', `${shift.toFixed(2)}px`);
            frontImage.style.setProperty('--o-days-shirt-lift', `${lift.toFixed(2)}px`);
            backImage.style.setProperty('--o-days-shirt-lift', `${lift.toFixed(2)}px`);
            frontImage.style.setProperty('--o-days-shirt-spin-x', `${spinX.toFixed(2)}deg`);
            frontImage.style.setProperty('--o-days-shirt-spin-y', `${spinY.toFixed(2)}deg`);
            backImage.style.setProperty('--o-days-shirt-spin-x', `${spinX.toFixed(2)}deg`);
            backImage.style.setProperty('--o-days-shirt-spin-y', `${spinY.toFixed(2)}deg`);
            shirtPair.style.setProperty('--o-days-back-visibility', window.scrollY >= splitStart ? 'visible' : 'hidden');
          }
        }
      }

      if (godFootballProject && !window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches) {
        const stickyImage = godFootballProject.querySelector('.spatial-stack-image-sticky');
        if (stickyImage) {
          const stack = godFootballProject.querySelector('.spatial-stack-images');
          if (!stickyImage.dataset.baseWidth || !stickyImage.dataset.baseHeight) {
            const originalWidth = stickyImage.offsetWidth;
            const originalHeight = stickyImage.offsetHeight;
            if (originalWidth && originalHeight) {
              stickyImage.dataset.baseWidth = String(originalWidth);
              stickyImage.dataset.baseHeight = String(originalHeight);
            }
          }
          const imageOffset = stickyImage.offsetTop;
          const stackOffset = stack ? stack.offsetTop : 0;
          const stickyStart = godFootballProject.offsetTop + stackOffset + imageOffset - viewportHeight / 2;
          const progress = Math.max(0, Math.min(1, (window.scrollY - stickyStart) / viewportHeight));
          const baseWidth = Number(stickyImage.dataset.baseWidth) || stickyImage.offsetWidth;
          const baseHeight = Number(stickyImage.dataset.baseHeight) || stickyImage.offsetHeight;
          const width = baseWidth + (window.innerWidth - baseWidth) * progress;
          const height = baseHeight + (viewportHeight - baseHeight) * progress;
          stickyImage.style.width = `${width.toFixed(2)}px`;
          stickyImage.style.height = `${height.toFixed(2)}px`;
        }
      }

      if (homeShirtProject && !window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches) {
        const stack = homeShirtProject.querySelector('.home-shirt-spatial-flip');
        const card = homeShirtProject.querySelector('.home-shirt-flip-card');
        if (stack && card) {
          const cardRect = card.getBoundingClientRect();
          const cardCenter = cardRect.top + cardRect.height / 2;
          const viewportCenter = viewportHeight / 2;
          const isLockedInCenter = cardCenter <= viewportCenter + 1;
          if (!isLockedInCenter) {
            card.removeAttribute('data-rotation-start');
            card.style.setProperty('--home-shirt-rotation', '0deg');
            return;
          }
          if (!card.dataset.rotationStart) {
            card.dataset.rotationStart = String(window.scrollY);
          }
          const rotationStart = Number(card.dataset.rotationStart);
          const rotationProgress = Math.max(0, Math.min(1, (window.scrollY - rotationStart) / (viewportHeight * 0.45)));
          const easedRotation = rotationProgress * rotationProgress * (3 - 2 * rotationProgress);
          card.style.setProperty('--home-shirt-rotation', `${(180 * easedRotation).toFixed(2)}deg`);
        }
      }
    }

    function queueDisplayTypeUpdate() {
      if (displayTypeUpdateQueued) return;
      displayTypeUpdateQueued = true;
      window.requestAnimationFrame(updateDisplayTypeForScroll);
    }

    projects.forEach((project) => {
      const images = quickViewImages(project);
      if (!images.length) return;
      project.style.setProperty('--row-background', `url("${images[0]}")`);
      project.addEventListener('pointerenter', (event) => showQuickView(project, event));
      project.addEventListener('pointermove', positionQuickView);
      project.addEventListener('pointerleave', hideQuickView);
      project.addEventListener('click', (event) => {
        const images = quickViewImages(project);
        if (document.body.classList.contains('list-view')) return;
        if (project.hasAttribute('data-spatial-stack') && !document.body.classList.contains('list-view')) return;
        if (images.length === 1 && project.getAttribute('href') !== '#') return;
        event.preventDefault();
        if (project.hasAttribute('data-open-after-cycle') && quickViewIndex === images.length - 1) {
          window.location.href = project.href;
          return;
        }
        quickViewIndex = (quickViewIndex + 1) % images.length;
        project.style.setProperty('--row-background', `url("${images[quickViewIndex]}")`);
        setProgressImage(quickView, images[quickViewIndex], {
          onStart: () => quickViewLoader.classList.add('is-visible'),
          onProgress: (progress) => {
            quickViewLoader.textContent = `${progress}%`;
          },
          onComplete: () => {
            quickViewLoader.classList.remove('is-visible');
            quickViewLoader.textContent = '';
          },
          onError: () => {
            quickViewLoader.classList.remove('is-visible');
            quickViewLoader.textContent = '';
          }
        });
        activeQuickViewProject = project;
        if (document.body.classList.contains('list-view')) {
          quickView.classList.add('is-visible');
          positionQuickView(event);
        }
      });
    });

    document.querySelectorAll('.list-dropdown-row[data-quick-view]').forEach((row) => {
      row.addEventListener('pointerenter', (event) => showQuickView(row, event));
      row.addEventListener('pointermove', positionQuickView);
      row.addEventListener('pointerleave', hideQuickView);
      row.addEventListener('click', (event) => {
        if (!document.body.classList.contains('list-view')) return;
        event.preventDefault();
        event.stopPropagation();
        showAllPreview(row);
      });
    });

    document.querySelectorAll('[data-list-dropdown]').forEach((project) => {
      project.addEventListener('click', (event) => {
        if (!document.body.classList.contains('list-view')) return;
        if (event.target.closest('a') !== project) return;
        if (event.target.closest('.list-dropdown')) return;
        event.preventDefault();
        showAllPreview(project);
        if (project !== nightJourneysProject) return;
        const isOpen = project.classList.toggle('is-dropdown-open');
        project.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) hideQuickView();
      });
    });

    function setView(view, { restoreImmediately = false } = {}) {
      const forcedMobileSpatial = mobileViewport.matches;
      if (forcedMobileSpatial) view = 'spatial';
      const isList = view === 'list';
      if (activeView === 'spatial' && view !== activeView) {
        spatialScrollPosition = window.scrollY;
      }
      activeView = view;
      document.body.classList.toggle('list-view', isList);
      if (!isList) {
        hideQuickView();
        document.querySelectorAll('[data-list-dropdown]').forEach((project) => {
          const isDefaultOpen = project.hasAttribute('data-list-dropdown-default-open');
          project.classList.toggle('is-dropdown-open', isDefaultOpen);
          project.setAttribute('aria-expanded', String(isDefaultOpen));
        });
      }

      const sortValue = (project) => Number(isList && project.dataset.listSort ? project.dataset.listSort : project.dataset.yearSort);
      const orderedProjects = [...projects].sort((a, b) => sortValue(b) - sortValue(a));

      orderedProjects.forEach((project) => workGrid.appendChild(project));
      if (isList) {
        hideQuickView();
        showAllPreview(activeAllSource || orderedProjects[0], true);
      } else {
        allPreviewMedia.querySelectorAll('video').forEach((video) => video.pause());
      }
      viewButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.view === view));
      });
      updateDisplayTypeForScroll();
      const restoreScroll = () => {
        window.scrollTo({
          top: isList ? 0 : spatialScrollPosition,
          behavior: 'auto'
        });
        queueDisplayTypeUpdate();
      };
      let scrollRestored;
      if (restoreImmediately) {
        restoreScroll();
        scrollRestored = Promise.resolve();
      } else {
        scrollRestored = new Promise((resolve) => window.requestAnimationFrame(() => {
          restoreScroll();
          resolve();
        }));
      }

      try {
        if (!forcedMobileSpatial) localStorage.setItem('graphic-project-view', view);
      } catch (error) {}
      return scrollRestored;
    }

    let activeViewTransition = null;
    let queuedView = null;
    function transitionView(view) {
      if (activeViewTransition) {
        queuedView = view;
        activeViewTransition.skipTransition();
        return;
      }
      if (view === activeView) return;
      if (!document.startViewTransition || reduceMotion.matches || mobileViewport.matches) {
        setView(view);
        return;
      }
      document.documentElement.dataset.viewDirection = view === 'list' ? 'to-all' : 'to-selected';
      const transition = document.startViewTransition(() => setView(view, { restoreImmediately: true }));
      activeViewTransition = transition;
      transition.ready.catch(() => {});
      transition.finished.catch(() => {}).finally(() => {
        activeViewTransition = null;
        delete document.documentElement.dataset.viewDirection;
        if (queuedView) {
          const next = queuedView;
          queuedView = null;
          transitionView(next);
        }
      });
    }

    viewButtons.forEach((button) => {
      button.addEventListener('click', () => transitionView(button.dataset.view));
    });

    function animateScrollPosition(scroller, targetTop, duration = 720) {
      const startTop = scroller === window ? window.scrollY : scroller.scrollTop;
      const distance = targetTop - startTop;
      if (reduceMotion.matches || Math.abs(distance) < 1) {
        if (scroller === window) {
          window.scrollTo(0, targetTop);
        } else {
          scroller.scrollTop = targetTop;
        }
        return;
      }

      const startTime = performance.now();
      const easeInOutCubic = (progress) => (
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2
      );

      const step = (now) => {
        const progress = Math.min(1, (now - startTime) / duration);
        const easedProgress = easeInOutCubic(progress);
        const nextTop = startTop + distance * easedProgress;
        if (scroller === window) {
          window.scrollTo(0, nextTop);
        } else {
          scroller.scrollTop = nextTop;
        }
        if (progress < 1) window.requestAnimationFrame(step);
      };

      window.requestAnimationFrame(step);
    }

    function scrollToNextProjectCenter() {
      const isMobileSpatial = mobileViewport.matches && !document.body.classList.contains('list-view');
      const scroller = isMobileSpatial ? workGrid : window;
      const candidates = isMobileSpatial
        ? [...mobileSpatialCatalogue?.querySelectorAll('.mobile-spatial-catalogue-item') || []]
        : [...spatialProjectGrid.querySelectorAll('.spatial-project-row')];
      if (!candidates.length) return;

      const viewportHeight = isMobileSpatial
        ? workGrid.clientHeight
        : window.innerHeight || document.documentElement.clientHeight;
      const currentTop = isMobileSpatial ? workGrid.scrollTop : window.scrollY;
      const target = candidates.find((item) => {
        const itemTop = isMobileSpatial ? item.offsetTop : window.scrollY + item.getBoundingClientRect().top;
        const itemCenter = itemTop + item.offsetHeight / 2;
        return itemCenter > currentTop + viewportHeight / 2 + 8;
      }) || candidates[0];

      const targetTop = isMobileSpatial
        ? target.offsetTop + target.offsetHeight / 2 - viewportHeight / 2
        : window.scrollY + target.getBoundingClientRect().top + target.offsetHeight / 2 - viewportHeight / 2;
      const maxTop = isMobileSpatial
        ? workGrid.scrollHeight - workGrid.clientHeight
        : document.documentElement.scrollHeight - viewportHeight;

      animateScrollPosition(scroller, Math.max(0, Math.min(targetTop, maxTop)));
    }

    scrollCue.addEventListener('click', () => {
      scrollToNextProjectCenter();
    });

    let savedView = 'spatial';
    try {
      savedView = localStorage.getItem('graphic-project-view') || 'spatial';
    } catch (error) {}
    const requestedView = new URLSearchParams(window.location.search).get('view');
    const initialView = mobileViewport.matches ? 'spatial'
      : ['spatial', 'list'].includes(requestedView) ? requestedView
      : savedView === 'list' ? 'list' : 'spatial';
    if (initialView === 'spatial' && mobileViewport.matches && nightJourneysProject) {
      spatialScrollPosition = nightJourneysProject.offsetTop;
    }
    setView(initialView);

    const defaultDisplayType = document.querySelector('.display-type-default');
    let displayPointerFrame = null;
    let displayPointerX = 0;
    let displayPointerY = 0;
    window.addEventListener('pointermove', (event) => {
      if (reduceMotion.matches || document.body.classList.contains('list-view') || !defaultDisplayType) return;
      displayPointerX = (event.clientX / window.innerWidth - 0.5) * -12;
      displayPointerY = (event.clientY / window.innerHeight - 0.5) * -8;
      if (displayPointerFrame !== null) return;
      displayPointerFrame = window.requestAnimationFrame(() => {
        displayPointerFrame = null;
        defaultDisplayType.style.setProperty('--move-x', `${displayPointerX.toFixed(2)}px`);
        defaultDisplayType.style.setProperty('--move-y', `${displayPointerY.toFixed(2)}px`);
      });
    }, { passive: true });

    window.addEventListener('scroll', queueDisplayTypeUpdate, { passive: true });
    workGrid?.addEventListener('scroll', queueDisplayTypeUpdate, { passive: true });
    window.addEventListener('resize', () => {
      if (mobileViewport.matches && document.body.classList.contains('list-view')) {
        setView('spatial');
      }
      if (oDaysProject) {
        const shirtPair = oDaysProject.querySelector('.o-days-shirt-pair');
        if (shirtPair) delete shirtPair.dataset.stickyStart;
      }
      if (godFootballProject) {
        const stickyImage = godFootballProject.querySelector('.spatial-stack-image-sticky');
        if (stickyImage) {
          delete stickyImage.dataset.baseWidth;
          delete stickyImage.dataset.baseHeight;
          stickyImage.style.width = '';
          stickyImage.style.height = '';
        }
      }
      queueDisplayTypeUpdate();
    }, { passive: true });

    new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => mutation.attributeName === 'class')) return;
      displayTypeLayers.forEach(({ project, layer }) => renderDisplayTypeLayer(project, layer));
      queueDisplayTypeUpdate();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    updateDisplayTypeForScroll();

    document.querySelectorAll('a[href="#"]').forEach((link) => {
      link.addEventListener('click', (event) => event.preventDefault());
    });
