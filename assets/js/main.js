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
        let source = slideshowImages[0];
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
        item.dataset.slideshowIndex = String(mobileSlideshows.length);
        item.dataset.slideshowImageIndex = String(Math.max(0, slideshowImages.indexOf(source)));
        if (project === nightJourneysProject) {
          project.dataset.slideshowIndex = String(mobileSlideshows.length);
        }
        const itemImages = slideshowImages.length ? slideshowImages : [source];
        mobileSlideshows.push({
          name,
          images: itemImages
        });

        const imageStage = document.createElement('span');
        imageStage.className = 'mobile-spatial-catalogue-image';
        const image = document.createElement('img');
        image.src = source;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        imageStage.appendChild(image);
        let mobileProjectWidthFrame = null;
        const syncMobileProjectWidth = () => {
          mobileProjectWidthFrame = null;
          const width = image.getBoundingClientRect().width;
          if (width > 0) {
            item.style.setProperty('--mobile-project-width', `${width}px`);
          }
        };
        const queueMobileProjectWidth = () => {
          if (mobileProjectWidthFrame !== null) return;
          mobileProjectWidthFrame = window.requestAnimationFrame(syncMobileProjectWidth);
        };
        image.addEventListener('load', queueMobileProjectWidth);
        window.addEventListener('resize', queueMobileProjectWidth);
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', queueMobileProjectWidth);
        }
        queueMobileProjectWidth();

        if (itemImages.length > 1) {
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
      row.className = images.length
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

      const detailsTitle = document.createElement('strong');
      detailsTitle.className = 'list-dropdown-copy-title list-dropdown-details-title';
      detailsTitle.textContent = 'Details';

      const details = [
        ['Year', year],
        ['Client', client],
        ['Format', format],
        ['Designer', 'Michael Tsalkos']
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

      if (document.body.classList.contains('list-view') || !displayTypeProjects.length) {
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
        let images = quickViewImages(row);
        if (!images.length) return;
        event.preventDefault();
        event.stopPropagation();
        hideQuickView();
        let imageIndex = 0;
        const title = row.querySelector('span:nth-child(2)')?.textContent.trim() || 'Night Journeys';
        const parentProject = row.closest('.project');
        if (parentProject?.dataset.displayType === 'Night|Journeys|') {
          const rows = [...parentProject.querySelectorAll('.list-dropdown-row[data-quick-view]')];
          images = rows.flatMap((item) => quickViewImages(item));
          imageIndex = rows
            .slice(0, rows.indexOf(row))
            .reduce((total, item) => total + quickViewImages(item).length, 0);
        }
        openSlideshowData({ name: title, images }, imageIndex);
      });
    });

    document.querySelectorAll('[data-list-dropdown]').forEach((project) => {
      project.addEventListener('click', (event) => {
        if (!document.body.classList.contains('list-view')) return;
        if (event.target.closest('.list-dropdown')) return;
        event.preventDefault();
        const isOpen = project.classList.toggle('is-dropdown-open');
        project.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) hideQuickView();
      });
    });

    function setView(view) {
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
      viewButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.view === view));
      });
      updateDisplayTypeForScroll();
      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: isList ? 0 : spatialScrollPosition,
          behavior: 'auto'
        });
        queueDisplayTypeUpdate();
      });

      try {
        if (!forcedMobileSpatial) localStorage.setItem('graphic-project-view', view);
      } catch (error) {}
    }

    viewButtons.forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.view));
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
        : [...workGrid.querySelectorAll('.project[data-curated]')];
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
    const initialView = mobileViewport.matches || requestedView === 'spatial' ? 'spatial' : savedView === 'list' ? 'list' : 'spatial';
    if (initialView === 'spatial' && nightJourneysProject) {
      spatialScrollPosition = nightJourneysProject.offsetTop;
    }
    setView(initialView);

    window.addEventListener('pointermove', (event) => {
      if (reduceMotion.matches) return;
      const x = (event.clientX / window.innerWidth - 0.5) * -12;
      const y = (event.clientY / window.innerHeight - 0.5) * -8;
      displayTypes.forEach((displayType) => {
        displayType.style.setProperty('--move-x', `${x.toFixed(2)}px`);
        displayType.style.setProperty('--move-y', `${y.toFixed(2)}px`);
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
