(() => {
  const ROBOT_ID = "autoscale-robot-capture-button";
  const STATUS_ID = "autoscale-robot-capture-status";
  const UI_HINTS =
    /\b(icon|logo|avatar|emoji|sprite|thumb|thumbnail|button|badge|spinner|loader|advert|ad-|tracking|pixel|placeholder)\b/i;
  const MEDIA_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|m4a|m4v|mp3|mp4|ogg|oga|opus|png|wav|webm|webp)(\?|#|$)/i;
  const AUDIO_EXTENSIONS = /\.(aac|flac|m4a|mp3|oga|ogg|opus|wav|webm)(\?|#|$)/i;
  const VIDEO_EXTENSIONS = /\.(m4v|mov|mp4|webm)(\?|#|$)/i;
  const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|png|webp)(\?|#|$)/i;

  let activeTarget = null;
  let activeAsset = null;
  let statusTimer = 0;

  const robotButton = document.createElement("button");
  robotButton.id = ROBOT_ID;
  robotButton.type = "button";
  robotButton.setAttribute("aria-label", "Send this asset to AutoScale");
  robotButton.innerHTML = `
    <span class="autoscale-robot-ring" aria-hidden="true"></span>
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9 3.75h6M12 3.75v2.1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"/>
      <rect x="5.25" y="6.1" width="13.5" height="10.9" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M8.75 17v1.35c0 .88.72 1.6 1.6 1.6h3.3c.88 0 1.6-.72 1.6-1.6V17" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M8.95 11.4h.02M15.03 11.4h.02" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.4"/>
      <path d="M9.55 14c1.3.75 3.6.75 4.9 0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>
      <path d="M5.25 10.35H3.8M20.2 10.35h-1.45" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"/>
    </svg>
  `;
  robotButton.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "display:none",
    "align-items:center",
    "justify-content:center",
    "height:48px",
    "width:48px",
    "border:1px solid rgba(190,242,100,.44)",
    "border-radius:18px",
    "background:linear-gradient(145deg,rgba(25,26,22,.96),rgba(9,10,8,.92))",
    "color:#d9ff80",
    "backdrop-filter:blur(16px)",
    "-webkit-backdrop-filter:blur(16px)",
    "box-shadow:0 18px 46px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.12), 0 0 0 6px rgba(190,242,100,.08)",
    "cursor:pointer",
    "padding:0",
    "transition:transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease, color 160ms ease",
  ].join(";");

  const statusBubble = document.createElement("div");
  statusBubble.id = STATUS_ID;
  statusBubble.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "display:none",
    "max-width:min(320px,calc(100vw - 20px))",
    "border:1px solid rgba(190,242,100,.22)",
    "border-radius:14px",
    "background:rgba(18,19,16,.96)",
    "color:#f4f4f0",
    "backdrop-filter:blur(14px)",
    "-webkit-backdrop-filter:blur(14px)",
    "font:800 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 18px 44px rgba(0,0,0,.36)",
    "padding:9px 11px",
    "pointer-events:none",
  ].join(";");

  const robotStyle = document.createElement("style");
  robotStyle.textContent = `
    #${ROBOT_ID} svg {
      height: 25px;
      position: relative;
      width: 25px;
      z-index: 1;
    }

    #${ROBOT_ID}:hover {
      border-color: rgba(217, 255, 128, .78) !important;
      box-shadow: 0 22px 54px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.16), 0 0 0 8px rgba(190,242,100,.12) !important;
      transform: translateY(-2px) scale(1.03);
    }

    #${ROBOT_ID}[data-capture-state="sending"] {
      color: #111 !important;
      background: linear-gradient(180deg,#dfff8e,#aee93b) !important;
      cursor: progress !important;
    }

    #${ROBOT_ID}[data-capture-state="sent"] {
      color: #111 !important;
      background: linear-gradient(180deg,#dcfce7,#86efac) !important;
      border-color: rgba(134,239,172,.86) !important;
    }

    #${ROBOT_ID}[data-kind="video"] {
      color: #bae6fd;
      border-color: rgba(125,211,252,.42);
      box-shadow: 0 18px 46px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.12), 0 0 0 6px rgba(125,211,252,.08);
    }

    #${ROBOT_ID}[data-kind="audio"] {
      color: #f0abfc;
      border-color: rgba(240,171,252,.42);
      box-shadow: 0 18px 46px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.12), 0 0 0 6px rgba(240,171,252,.08);
    }

    #${ROBOT_ID} .autoscale-robot-ring {
      animation: autoscaleRobotPulse 1.8s ease-in-out infinite;
      border: 1px solid currentColor;
      border-radius: 22px;
      inset: 5px;
      opacity: .18;
      position: absolute;
    }

    @keyframes autoscaleRobotPulse {
      0%, 100% { transform: scale(.94); opacity: .14; }
      50% { transform: scale(1.08); opacity: .28; }
    }
  `;

  document.documentElement.append(robotStyle, robotButton, statusBubble);

  function showInlineStatus(message, tone = "neutral") {
    window.clearTimeout(statusTimer);
    statusBubble.textContent = message;
    statusBubble.style.display = "block";
    statusBubble.style.borderColor = tone === "error" ? "rgba(252,165,165,.42)" : "rgba(190,242,100,.34)";
    statusBubble.style.color = tone === "error" ? "#fecaca" : "#f4f4f0";
    positionRobot();
    statusTimer = window.setTimeout(() => {
      statusBubble.style.display = "none";
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

  function uniqueUrls(urls) {
    return Array.from(new Set(urls.filter(Boolean)));
  }

  function decodeEscapedText(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\//g, "/");
  }

  function looksLikeStreamFragmentUrl(url) {
    const lower = url.toLowerCase();
    return /(\.m3u8|\.m4s|\.ts)(\?|#|$)|mpegurl|\/hls\/|\/dash\/|segment|fragment|init\.mp4|range=|bytestart=|byteend=/.test(lower);
  }

  function looksLikeVideoUrl(url) {
    const lower = url.toLowerCase();
    if (/\.(js|css|json|html?|svg|png|jpe?g|webp|avif|gif)(\?|#|$)/.test(lower) || looksLikeStreamFragmentUrl(url)) {
      return false;
    }

    return (
      VIDEO_EXTENSIONS.test(url) ||
      /\/video\/|\/video\/tos\/|video_|video_mp4|mime_type=video|playaddr|downloadaddr|bytevid|videoplayback|cdninstagram/.test(lower)
    );
  }

  function findLikelyResourceUrls(kind, limit = 10) {
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
            (/\/video\/|video_|mime_type=video|video_mp4|\.mp4|bytevid|videoplayback|cdninstagram/i.test(lower) &&
              !looksLikeStreamFragmentUrl(name) &&
              !/\.(js|css|json|html?|svg|png|jpe?g|webp|avif|gif)(\?|#|$)/i.test(lower));
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

    return entries.slice(0, limit).map((entry) => entry.name);
  }

  function findLikelyResourceUrl(kind) {
    return findLikelyResourceUrls(kind, 1)[0] || null;
  }

  function getMetaVideoUrls() {
    const selectors = [
      "meta[property='og:video']",
      "meta[property='og:video:url']",
      "meta[property='og:video:secure_url']",
      "meta[name='twitter:player:stream']",
    ];

    return selectors
      .map((selector) => normalizeUrl(document.querySelector(selector)?.getAttribute("content")))
      .filter((url) => url && looksLikeVideoUrl(url));
  }

  function extractScriptMediaUrls(kind) {
    const matches = [];
    const scripts = Array.from(document.scripts).slice(-36);
    const matcher = /https?:\/\/[^"'<>\s\\]+/g;

    const addUrl = (value) => {
      const decoded = decodeEscapedText(value);
      const url = normalizeUrl(decoded);
      if (!url) {
        return;
      }

      if (kind === "video" && looksLikeVideoUrl(url)) {
        matches.push(url);
      }
    };

    const walk = (value, depth = 0, keyHint = "") => {
      if (depth > 10 || value == null) {
        return;
      }

      if (typeof value === "string") {
        const decoded = decodeEscapedText(value);
        if (/https?:\/\//.test(decoded) && (keyHint || /video|play|download|url/i.test(decoded))) {
          for (const match of decoded.matchAll(matcher)) {
            addUrl(match[0]);
          }
        }
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => walk(entry, depth + 1, keyHint));
        return;
      }

      if (typeof value === "object") {
        for (const [key, entry] of Object.entries(value)) {
          const mediaKey = /playAddr|downloadAddr|playApi|urlList|bitrateInfo|video|download|play|mainUrl|backupUrl|url/i.test(key);
          walk(entry, depth + 1, mediaKey ? key : keyHint);
        }
      }
    };

    for (const script of scripts) {
      const text = script.textContent;
      if (!text || (!/video|playAddr|downloadAddr|bitrateInfo|audio|stream/i.test(text))) {
        continue;
      }

      const normalizedText = decodeEscapedText(text);

      for (const match of normalizedText.matchAll(matcher)) {
        addUrl(match[0]);
      }

      const trimmed = text.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          walk(JSON.parse(trimmed));
        } catch {
          // Some platforms inline relaxed JS instead of strict JSON. The URL regex above still catches exposed media URLs.
        }
      }
    }

    return uniqueUrls(matches).slice(0, 12);
  }

  function buildVideoCandidateUrls(video) {
    const directCandidates = [
      normalizeUrl(video.currentSrc),
      normalizeUrl(video.src),
      normalizeUrl(video.querySelector("source[src]")?.getAttribute("src")),
    ];

    const candidates = uniqueUrls([
      ...directCandidates,
      ...getMetaVideoUrls(),
      ...findLikelyResourceUrls("video", 10),
      ...extractScriptMediaUrls("video"),
    ]);

    return candidates.sort((left, right) => {
      const score = (url) => {
        const lower = url.toLowerCase();
        return (
          (lower.includes(".mp4") ? 70 : 0) +
          (lower.includes("mime_type=video_mp4") ? 70 : 0) +
          (lower.includes("/video/tos/") ? 55 : 0) +
          (lower.includes("playaddr") || lower.includes("downloadaddr") ? 35 : 0) +
          (lower.includes("bytevid") || lower.includes("videoplayback") ? 20 : 0) +
          (lower.includes("cdninstagram") ? 12 : 0) +
          (looksLikeStreamFragmentUrl(url) ? -120 : 0) +
          (/\.(js|css|json|html?|svg|png|jpe?g|webp|avif|gif)(\?|#|$)/.test(lower) ? -120 : 0)
        );
      };

      return score(right) - score(left);
    });
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
    const candidateUrls = buildVideoCandidateUrls(video);
    const sourceUrl = candidateUrls[0] || null;

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
      candidateUrls,
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
    if (!(target instanceof Element) || robotButton.contains(target) || statusBubble.contains(target)) {
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
    if (!statusBubble.textContent) {
      statusBubble.style.display = "none";
    }
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

    const buttonWidth = robotButton.offsetWidth || 48;
    const top = Math.max(8, Math.min(window.innerHeight - 58, rect.top + 12));
    const left = Math.max(8, Math.min(window.innerWidth - buttonWidth - 8, rect.left + rect.width / 2 - buttonWidth / 2));

    robotButton.style.left = `${left}px`;
    robotButton.style.top = `${top}px`;
    robotButton.style.display = "flex";

    if (statusBubble.style.display !== "none") {
      const statusWidth = statusBubble.offsetWidth || 220;
      statusBubble.style.left = `${Math.max(8, Math.min(window.innerWidth - statusWidth - 8, left + buttonWidth / 2 - statusWidth / 2))}px`;
      statusBubble.style.top = `${Math.min(window.innerHeight - 48, top + 56)}px`;
    }
  }

  function activateAsset(target, asset) {
    activeTarget = target;
    activeAsset = asset;
    robotButton.dataset.kind = asset.kind;
    robotButton.title = `Send ${asset.kind} to AutoScale`;
    robotButton.dataset.captureState = "ready";
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

    const assetToSend = activeAsset;
    robotButton.disabled = true;
    robotButton.dataset.captureState = "sending";
    showInlineStatus(`Sending ${assetToSend.kind}...`);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "AUTOSCALE_CAPTURE_ASSET",
        payload: { asset: assetToSend },
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Unable to send asset to AutoScale");
      }

      robotButton.dataset.captureState = "sent";
      showInlineStatus(response.message || `${assetToSend.kind} sent to AutoScale.`, "ok");
    } catch (error) {
      robotButton.dataset.captureState = "error";
      showInlineStatus(error instanceof Error ? error.message : "Unable to send asset to AutoScale", "error");
    } finally {
      window.setTimeout(() => {
        robotButton.disabled = false;
        robotButton.dataset.captureState = "ready";
      }, 450);
    }
  });
})();
