(() => {
  const ROBOT_ID = "autoscale-robot-capture-button";
  const TOAST_ID = "autoscale-robot-capture-toast";
  const UI_HINTS =
    /\b(icon|logo|avatar|emoji|sprite|thumb|thumbnail|button|badge|spinner|loader|advert|ad-|tracking|pixel|placeholder)\b/i;
  const MEDIA_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|m4a|m4v|mp3|mp4|ogg|oga|opus|png|wav|webm|webp)(\?|#|$)/i;
  const AUDIO_EXTENSIONS = /\.(aac|flac|m4a|mp3|oga|ogg|opus|wav|webm)(\?|#|$)/i;
  const VIDEO_EXTENSIONS = /\.(m4v|mov|mp4|webm)(\?|#|$)/i;
  const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|png|webp)(\?|#|$)/i;

  let activeTarget = null;
  let activeAsset = null;
  let hideTimer = 0;

  const robotButton = document.createElement("button");
  robotButton.id = ROBOT_ID;
  robotButton.type = "button";
  robotButton.textContent = "Robot";
  robotButton.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "display:none",
    "height:34px",
    "min-width:76px",
    "border:1px solid rgba(16,16,16,.22)",
    "border-radius:999px",
    "background:#bef264",
    "color:#111",
    "font:800 12px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 12px 34px rgba(0,0,0,.32)",
    "cursor:pointer",
    "letter-spacing:.02em",
    "padding:0 14px",
  ].join(";");

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "right:16px",
    "bottom:16px",
    "display:none",
    "max-width:320px",
    "border:1px solid rgba(255,255,255,.12)",
    "border-radius:12px",
    "background:rgba(24,24,24,.96)",
    "color:#f4f4f0",
    "font:700 12px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 18px 52px rgba(0,0,0,.35)",
    "padding:11px 12px",
  ].join(";");

  document.documentElement.append(robotButton, toast);

  function showToast(message, tone = "neutral") {
    window.clearTimeout(hideTimer);
    toast.textContent = message;
    toast.style.display = "block";
    toast.style.borderColor = tone === "error" ? "rgba(252,165,165,.35)" : "rgba(190,242,100,.26)";
    toast.style.color = tone === "error" ? "#fecaca" : "#f4f4f0";
    hideTimer = window.setTimeout(() => {
      toast.style.display = "none";
    }, 3600);
  }

  function normalizeUrl(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("filesystem:")) {
      return null;
    }

    try {
      const url = new URL(trimmed, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "data:" ? url.href : null;
    } catch {
      return null;
    }
  }

  function guessMime(url, fallback = "") {
    const lower = url.split("?")[0].toLowerCase();
    if (lower.endsWith(".avif")) return "image/avif";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return fallback || "video/webm";
    if (lower.endsWith(".mp3")) return "audio/mpeg";
    if (lower.endsWith(".m4a")) return "audio/mp4";
    if (lower.endsWith(".wav")) return "audio/wav";
    if (lower.endsWith(".ogg") || lower.endsWith(".oga") || lower.endsWith(".opus")) return "audio/ogg";
    return fallback;
  }

  function findLikelyResourceUrl(kind) {
    const entries = performance
      .getEntriesByType("resource")
      .filter((entry) => /^https?:/i.test(entry.name))
      .map((entry) => {
        const name = entry.name;
        const lower = name.toLowerCase();
        const size = entry.transferSize || entry.encodedBodySize || entry.decodedBodySize || 0;
        const recentScore = entry.startTime || 0;
        let matches = false;

        if (kind === "video") {
          matches =
            VIDEO_EXTENSIONS.test(name) ||
            /\/video\/|video_|mime_type=video|mp4|bytevid|videoplayback|tiktokcdn|cdninstagram/i.test(lower);
        } else if (kind === "audio") {
          matches =
            AUDIO_EXTENSIONS.test(name) ||
            /\/audio\/|audio_|mime_type=audio|mp3|m4a|soundcloud|audioplayback|stream/i.test(lower);
        } else {
          matches = IMAGE_EXTENSIONS.test(name) || entry.initiatorType === "img";
        }

        return { name, matches, score: size + recentScore };
      })
      .filter((entry) => entry.matches)
      .sort((left, right) => right.score - left.score);

    return entries[0]?.name || null;
  }

  function getElementText(element) {
    const aria = element.getAttribute("aria-label");
    const title = element.getAttribute("title");
    const alt = element instanceof HTMLImageElement ? element.alt : "";
    const text = aria || title || alt || document.title || "Captured asset";
    return text.replace(/\s+/g, " ").trim().slice(0, 120);
  }

  function rectFor(element) {
    const rect = element.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return rect;
  }

  function isVisible(element, rect = rectFor(element)) {
    if (!rect) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity || "1") > 0.05 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  function hasUiHints(element, url = "") {
    const hint = [
      element.id,
      element.className && typeof element.className === "string" ? element.className : "",
      element.getAttribute("alt") || "",
      element.getAttribute("aria-label") || "",
      element.getAttribute("role") || "",
      url,
    ].join(" ");

    if (UI_HINTS.test(hint)) {
      return true;
    }

    const smallInteractiveParent = element.closest("button, nav, header, footer, [role='button'], [aria-label*='close' i]");
    const rect = rectFor(element);
    return Boolean(smallInteractiveParent && rect && rect.width * rect.height < 120000);
  }

  function parseSrcset(srcset) {
    return srcset
      .split(",")
      .map((item) => {
        const [rawUrl, descriptor] = item.trim().split(/\s+/, 2);
        const width = descriptor?.endsWith("w") ? Number.parseInt(descriptor, 10) : 0;
        const density = descriptor?.endsWith("x") ? Number.parseFloat(descriptor) : 0;
        return { url: normalizeUrl(rawUrl), score: width || density * 1000 || 1 };
      })
      .filter((item) => item.url)
      .sort((left, right) => right.score - left.score);
  }

  function bestImageUrl(img) {
    const srcset = img.getAttribute("srcset");
    const bestFromSrcset = srcset ? parseSrcset(srcset)[0]?.url : null;
    return normalizeUrl(img.currentSrc) || bestFromSrcset || normalizeUrl(img.src);
  }

  function buildImageAsset(img) {
    const rect = rectFor(img);
    const url = bestImageUrl(img);

    if (!url || !isVisible(img, rect) || hasUiHints(img, url)) {
      return null;
    }

    const displayedArea = rect.width * rect.height;
    const naturalWidth = img.naturalWidth || Math.round(rect.width * window.devicePixelRatio);
    const naturalHeight = img.naturalHeight || Math.round(rect.height * window.devicePixelRatio);
    const naturalArea = naturalWidth * naturalHeight;
    const largeEnough =
      rect.width >= 220 &&
      rect.height >= 180 &&
      displayedArea >= 70000 &&
      (naturalArea >= 360000 || Math.max(naturalWidth, naturalHeight) >= 720 || MEDIA_EXTENSIONS.test(url));

    if (!largeEnough) {
      return null;
    }

    return {
      kind: "image",
      url,
      label: getElementText(img),
      pageUrl: window.location.href,
      pageTitle: document.title,
      width: naturalWidth,
      height: naturalHeight,
      mimeHint: guessMime(url, "image/jpeg"),
    };
  }

  function buildVideoAsset(video) {
    const rect = rectFor(video);
    const sourceUrl =
      normalizeUrl(video.currentSrc) ||
      normalizeUrl(video.src) ||
      normalizeUrl(video.querySelector("source[src]")?.getAttribute("src")) ||
      findLikelyResourceUrl("video");

    if (!sourceUrl || !isVisible(video, rect) || hasUiHints(video, sourceUrl)) {
      return null;
    }

    const largeEnough = rect.width >= 220 && rect.height >= 180 && rect.width * rect.height >= 70000;
    if (!largeEnough) {
      return null;
    }

    return {
      kind: "video",
      url: sourceUrl,
      posterUrl: normalizeUrl(video.poster),
      label: getElementText(video),
      pageUrl: window.location.href,
      pageTitle: document.title,
      width: video.videoWidth || Math.round(rect.width),
      height: video.videoHeight || Math.round(rect.height),
      duration: Number.isFinite(video.duration) ? video.duration : null,
      mimeHint: guessMime(sourceUrl, video.querySelector("source[type]")?.getAttribute("type") || "video/mp4"),
    };
  }

  function buildAudioAsset(audio, hostElement = audio) {
    const rect = rectFor(hostElement);
    const sourceUrl =
      normalizeUrl(audio.currentSrc) ||
      normalizeUrl(audio.src) ||
      normalizeUrl(audio.querySelector("source[src]")?.getAttribute("src")) ||
      findLikelyResourceUrl("audio");

    if (!sourceUrl || !isVisible(hostElement, rect) || hasUiHints(hostElement, sourceUrl)) {
      return null;
    }

    if (rect.width < 220 && !AUDIO_EXTENSIONS.test(sourceUrl)) {
      return null;
    }

    return {
      kind: "audio",
      url: sourceUrl,
      label: getElementText(hostElement),
      pageUrl: window.location.href,
      pageTitle: document.title,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      duration: Number.isFinite(audio.duration) ? audio.duration : null,
      mimeHint: guessMime(sourceUrl, audio.querySelector("source[type]")?.getAttribute("type") || "audio/mpeg"),
    };
  }

  function extractBackgroundUrl(element) {
    const style = window.getComputedStyle(element);
    const image = style.backgroundImage || "";
    const match = image.match(/url\((["']?)(.*?)\1\)/i);
    return match ? normalizeUrl(match[2]) : null;
  }

  function buildBackgroundImageAsset(element) {
    const rect = rectFor(element);
    const url = extractBackgroundUrl(element);

    if (!url || !isVisible(element, rect) || hasUiHints(element, url) || !IMAGE_EXTENSIONS.test(url)) {
      return null;
    }

    if (rect.width < 300 || rect.height < 220 || rect.width * rect.height < 110000) {
      return null;
    }

    return {
      kind: "image",
      url,
      label: getElementText(element),
      pageUrl: window.location.href,
      pageTitle: document.title,
      width: Math.round(rect.width * window.devicePixelRatio),
      height: Math.round(rect.height * window.devicePixelRatio),
      mimeHint: guessMime(url, "image/jpeg"),
    };
  }

  function getMetaAudioUrl() {
    const selectors = [
      "meta[property='og:audio']",
      "meta[property='og:audio:url']",
      "meta[property='og:audio:secure_url']",
      "meta[name='twitter:player:stream']",
    ];

    for (const selector of selectors) {
      const url = normalizeUrl(document.querySelector(selector)?.getAttribute("content"));
      if (url && AUDIO_EXTENSIONS.test(url)) {
        return url;
      }
    }

    return null;
  }

  function buildMetaAudioAsset(element) {
    const rect = rectFor(element);
    const url = getMetaAudioUrl();

    if (!url || !isVisible(element, rect) || hasUiHints(element, url)) {
      return null;
    }

    if (rect.width < 300 || rect.height < 80) {
      return null;
    }

    return {
      kind: "audio",
      url,
      label: getElementText(element),
      pageUrl: window.location.href,
      pageTitle: document.title,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      duration: null,
      mimeHint: guessMime(url, "audio/mpeg"),
    };
  }

  function buildAnchorMediaAsset(anchor) {
    const rect = rectFor(anchor);
    const url = normalizeUrl(anchor.href);

    if (!url || !isVisible(anchor, rect) || hasUiHints(anchor, url)) {
      return null;
    }

    if (AUDIO_EXTENSIONS.test(url) && rect.width >= 180) {
      return {
        kind: "audio",
        url,
        label: getElementText(anchor),
        pageUrl: window.location.href,
        pageTitle: document.title,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        duration: null,
        mimeHint: guessMime(url, "audio/mpeg"),
      };
    }

    if (VIDEO_EXTENSIONS.test(url) && rect.width >= 220 && rect.height >= 120) {
      return {
        kind: "video",
        url,
        label: getElementText(anchor),
        pageUrl: window.location.href,
        pageTitle: document.title,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        duration: null,
        mimeHint: guessMime(url, "video/mp4"),
      };
    }

    return null;
  }

  function findAssetFromTarget(target) {
    if (!(target instanceof Element) || robotButton.contains(target) || toast.contains(target)) {
      return null;
    }

    let element = target;
    for (let depth = 0; element && depth < 8; depth += 1, element = element.parentElement) {
      if (element instanceof HTMLImageElement) {
        const asset = buildImageAsset(element);
        if (asset) return { target: element, asset };
      }

      if (element instanceof HTMLVideoElement) {
        const asset = buildVideoAsset(element);
        if (asset) return { target: element, asset };
      }

      if (element instanceof HTMLAudioElement) {
        const asset = buildAudioAsset(element);
        if (asset) return { target: element, asset };
      }

      const nestedVideo = element.querySelector?.("video");
      if (nestedVideo instanceof HTMLVideoElement) {
        const asset = buildVideoAsset(nestedVideo);
        if (asset) return { target: nestedVideo, asset };
      }

      const nestedAudio = element.querySelector?.("audio");
      if (nestedAudio instanceof HTMLAudioElement) {
        const asset = buildAudioAsset(nestedAudio, element);
        if (asset) return { target: element, asset };
      }

      if (element instanceof HTMLAnchorElement) {
        const asset = buildAnchorMediaAsset(element);
        if (asset) return { target: element, asset };
      }

      const backgroundAsset = buildBackgroundImageAsset(element);
      if (backgroundAsset) return { target: element, asset: backgroundAsset };

      const className = typeof element.className === "string" ? element.className : "";
      if (/sound|audio|track|waveform/i.test(`${className} ${element.id}`)) {
        const metaAudioAsset = buildMetaAudioAsset(element);
        if (metaAudioAsset) return { target: element, asset: metaAudioAsset };
      }
    }

    return null;
  }

  function hideRobot() {
    activeTarget = null;
    activeAsset = null;
    robotButton.style.display = "none";
  }

  function positionRobot() {
    if (!activeTarget || !activeAsset) {
      hideRobot();
      return;
    }

    const rect = rectFor(activeTarget);
    if (!isVisible(activeTarget, rect)) {
      hideRobot();
      return;
    }

    const buttonWidth = robotButton.offsetWidth || 76;
    const top = Math.max(8, Math.min(window.innerHeight - 42, rect.top + 10));
    const left = Math.max(8, Math.min(window.innerWidth - buttonWidth - 8, rect.left + rect.width / 2 - buttonWidth / 2));

    robotButton.style.left = `${left}px`;
    robotButton.style.top = `${top}px`;
    robotButton.style.display = "block";
  }

  function activateAsset(target, asset) {
    activeTarget = target;
    activeAsset = asset;
    robotButton.dataset.kind = asset.kind;
    robotButton.title = `Send ${asset.kind} to AutoScale`;
    positionRobot();
  }

  document.addEventListener(
    "pointermove",
    (event) => {
      if (robotButton.contains(event.target)) {
        return;
      }

      const found = findAssetFromTarget(event.target);
      if (!found) {
        const activeRect = activeTarget?.getBoundingClientRect();
        if (
          !activeRect ||
          event.clientX < activeRect.left ||
          event.clientX > activeRect.right ||
          event.clientY < activeRect.top ||
          event.clientY > activeRect.bottom
        ) {
          hideRobot();
        }
        return;
      }

      if (found.target !== activeTarget || found.asset.url !== activeAsset?.url) {
        activateAsset(found.target, found.asset);
      } else {
        positionRobot();
      }
    },
    { passive: true },
  );

  window.addEventListener("scroll", positionRobot, { passive: true });
  window.addEventListener("resize", positionRobot, { passive: true });

  robotButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!activeAsset) {
      return;
    }

    robotButton.disabled = true;
    robotButton.textContent = "Sending";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "AUTOSCALE_CAPTURE_ASSET",
        payload: { asset: activeAsset },
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Unable to send asset to AutoScale");
      }

      showToast(response.message || "Asset sent to AutoScale.", "ok");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to send asset to AutoScale", "error");
    } finally {
      robotButton.disabled = false;
      robotButton.textContent = "Robot";
    }
  });
})();
