const NORMAL_PLAYBACK_RATE = 1;

const player = videojs(
  "video",
  {
    autoplay: false,
    controls: true,
    fluid: true,
    inactivityTimeout: 2200,
    enableSmoothSeeking: true,
    volume: 0.8,
    controlBar: {
      children: [
        "playToggle",
        "volumePanel",
        "currentTimeDisplay",
        "timeDivider",
        "durationDisplay",
        "progressControl",
        "fullscreenToggle",
      ],
      volumePanel: { inline: true },
    },
  },
  () => {
    enforceNormalPlaybackRate();
    // 明确保持初始暂停，避免浏览器扩展恢复上次播放。
    player.pause();
  },
);

const playerWrap = document.querySelector("#playerWrap");
const pageShell = document.querySelector(".page-shell");
const peekToggle = document.querySelector("#peekToggle");

function enforceNormalPlaybackRate() {
  const mediaElement = player.el().querySelector("video");
  if (mediaElement) mediaElement.defaultPlaybackRate = NORMAL_PLAYBACK_RATE;
  if (player.playbackRate() !== NORMAL_PLAYBACK_RATE) {
    player.playbackRate(NORMAL_PLAYBACK_RATE);
  }
}

function installDeferredSeeking() {
  const progressControl = player.el().querySelector(".vjs-progress-control");
  const progressHolder = player.el().querySelector(".vjs-progress-holder");
  const playProgress = player.el().querySelector(".vjs-play-progress");
  const mediaElement = player.el().querySelector("video");
  const seekBar = player.controlBar.progressControl.seekBar;
  const mouseTimeDisplay = seekBar?.getChild("mouseTimeDisplay");
  if (
    !progressControl
    || !progressHolder
    || !playProgress
    || !mediaElement
    || !seekBar
  ) return;

  let dragInput = null;
  let previewTime = null;
  let queuedTime = null;
  let seekInFlight = false;

  const timeFromClientX = (clientX) => {
    const duration = player.duration();
    if (!Number.isFinite(duration) || duration <= 0) return null;

    const bounds = progressHolder.getBoundingClientRect();
    if (bounds.width <= 0) return null;
    const fraction = Math.max(
      0,
      Math.min(1, (clientX - bounds.left) / bounds.width),
    );
    return Math.min(duration - 0.1, fraction * duration);
  };

  const previewAt = (clientX) => {
    const nextTime = timeFromClientX(clientX);
    if (nextTime === null) return;

    const duration = player.duration();
    const fraction = nextTime / duration;
    const bounds = progressHolder.getBoundingClientRect();
    previewTime = nextTime;
    seekBar.pendingSeekTime(nextTime);
    seekBar.update({ target: seekBar });
    mouseTimeDisplay?.update(bounds, fraction);
    playProgress.style.width = `${fraction * 100}%`;
  };

  const runQueuedSeek = () => {
    if (seekInFlight || queuedTime === null) return;

    const targetTime = queuedTime;
    queuedTime = null;

    if (Math.abs(mediaElement.currentTime - targetTime) < 0.05) {
      runQueuedSeek();
      return;
    }

    seekInFlight = true;

    mediaElement.addEventListener("seeked", () => {
      seekInFlight = false;
      player.trigger("timeupdate");
      runQueuedSeek();
    }, { once: true });

    // 直接设置原生 currentTime，避免 Video.js 在 iOS 上改用 fastSeek。
    mediaElement.currentTime = targetTime;
  };

  const queueSeek = (targetTime) => {
    queuedTime = targetTime;
    runQueuedSeek();
  };

  const beginDrag = (event, input, clientX) => {
    if (dragInput !== null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dragInput = input;
    player.scrubbing(false);
    player.addClass("is-preview-seeking");
    previewAt(clientX);
  };

  const moveDrag = (event, input, clientX) => {
    if (dragInput !== input) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    previewAt(clientX);
  };

  const finishDrag = (event, input, clientX) => {
    if (dragInput !== input) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (Number.isFinite(clientX)) previewAt(clientX);

    const targetTime = previewTime;
    dragInput = null;
    previewTime = null;
    seekBar.pendingSeekTime(null);
    player.scrubbing(false);
    player.removeClass("is-preview-seeking");
    if (targetTime !== null) queueSeek(targetTime);
  };

  const cancelDrag = (event, input) => {
    if (dragInput !== input) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dragInput = null;
    previewTime = null;
    seekBar.pendingSeekTime(null);
    player.scrubbing(false);
    player.removeClass("is-preview-seeking");
    seekBar.update();
  };

  progressControl.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    beginDrag(event, "mouse", event.clientX);
  }, { capture: true });

  document.addEventListener("mousemove", (event) => {
    moveDrag(event, "mouse", event.clientX);
  }, { capture: true });

  document.addEventListener("mouseup", (event) => {
    finishDrag(event, "mouse", event.clientX);
  }, { capture: true });

  progressControl.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    beginDrag(event, "touch", event.touches[0].clientX);
  }, { capture: true, passive: false });

  document.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    if (touch) moveDrag(event, "touch", touch.clientX);
  }, { capture: true, passive: false });

  document.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    finishDrag(event, "touch", touch?.clientX);
  }, { capture: true, passive: false });

  document.addEventListener("touchcancel", (event) => {
    cancelDrag(event, "touch");
  }, { capture: true, passive: false });
}

player.ready(installDeferredSeeking);

const updatePeekOffset = () => {
  const currentOffset = pageShell.classList.contains("is-peeking")
    ? Number.parseFloat(
        getComputedStyle(pageShell).getPropertyValue("--peek-offset"),
      ) || 0
    : 0;
  const shellTop = pageShell.getBoundingClientRect().top - currentOffset;
  const targetTop = window.innerHeight * 0.7;
  pageShell.style.setProperty(
    "--peek-offset",
    `${Math.max(0, targetTop - shellTop)}px`,
  );
};

const setPeeking = (isPeeking) => {
  if (isPeeking) updatePeekOffset();

  pageShell.classList.toggle("is-peeking", isPeeking);
  peekToggle.setAttribute("aria-pressed", String(isPeeking));
  peekToggle.setAttribute(
    "aria-label",
    isPeeking ? "恢复卡片居中" : "下移卡片以查看背景",
  );
  peekToggle.title = isPeeking ? "恢复居中" : "查看背景";
};

peekToggle.addEventListener("click", () => {
  setPeeking(!pageShell.classList.contains("is-peeking"));
});

let resizeFrame;
window.addEventListener("resize", () => {
  if (!pageShell.classList.contains("is-peeking")) return;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(updatePeekOffset);
});

player.on("loadedmetadata", enforceNormalPlaybackRate);
player.on("ratechange", enforceNormalPlaybackRate);
player.on("play", () => {
  enforceNormalPlaybackRate();
  playerWrap.classList.add("is-playing");
});
player.on("pause", () => playerWrap.classList.remove("is-playing"));
player.on("ended", () => playerWrap.classList.remove("is-playing"));

// 常见播放器快捷键：空格/K、左右方向键、M、F。
player.el().addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === " " || key === "k") {
    event.preventDefault();
    player.paused() ? player.play() : player.pause();
  } else if (key === "arrowleft") {
    event.preventDefault();
    player.currentTime(Math.max(0, player.currentTime() - 5));
  } else if (key === "arrowright") {
    event.preventDefault();
    player.currentTime(Math.min(player.duration() || 0, player.currentTime() + 5));
  } else if (key === "m") {
    player.muted(!player.muted());
  } else if (key === "f") {
    player.isFullscreen() ? player.exitFullscreen() : player.requestFullscreen();
  }
});

player.on("userinactive", () => playerWrap.classList.add("controls-hidden"));
player.on("useractive", () => playerWrap.classList.remove("controls-hidden"));
