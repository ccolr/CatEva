const NORMAL_PLAYBACK_RATE = 1;

const player = videojs(
  "video",
  {
    autoplay: false,
    controls: true,
    fluid: true,
    inactivityTimeout: 2200,
    enableSmoothSeeking: true,
    disableSeekWhileScrubbingOnMobile: true,
    disableSeekWhileScrubbingOnSTV: true,
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

function installIosTouchSeeking() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return;

  const progressControl = player.el().querySelector(".vjs-progress-control");
  const progressHolder = player.el().querySelector(".vjs-progress-holder");
  const seekBar = player.controlBar.progressControl.seekBar;
  if (!progressControl || !progressHolder || !seekBar) return;

  let pendingTime = null;
  let resumeAfterSeek = false;

  const timeFromTouch = (touch) => {
    const duration = player.duration();
    if (!Number.isFinite(duration) || duration <= 0) return null;

    const bounds = progressHolder.getBoundingClientRect();
    const fraction = Math.max(
      0,
      Math.min(1, (touch.clientX - bounds.left) / bounds.width),
    );
    return Math.min(duration - 0.1, fraction * duration);
  };

  const previewTouch = (event) => {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return;
    const nextTime = timeFromTouch(touch);
    if (nextTime === null) return;

    pendingTime = nextTime;
    seekBar.pendingSeekTime(nextTime);
    seekBar.update();
  };

  progressControl.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    resumeAfterSeek = !player.paused();
    if (resumeAfterSeek) player.pause();
    player.scrubbing(true);
    previewTouch(event);
  }, { capture: true, passive: false });

  progressControl.addEventListener("touchmove", (event) => {
    if (pendingTime === null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    previewTouch(event);
  }, { capture: true, passive: false });

  progressControl.addEventListener("touchend", (event) => {
    if (pendingTime === null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    previewTouch(event);

    const targetTime = pendingTime;
    pendingTime = null;
    seekBar.pendingSeekTime(null);
    player.currentTime(targetTime);
    player.scrubbing(false);
    player.trigger("timeupdate");
    if (resumeAfterSeek) player.play();
  }, { capture: true, passive: false });

  progressControl.addEventListener("touchcancel", (event) => {
    if (pendingTime === null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pendingTime = null;
    seekBar.pendingSeekTime(null);
    player.scrubbing(false);
    seekBar.update();
    if (resumeAfterSeek) player.play();
  }, { capture: true, passive: false });
}

player.ready(installIosTouchSeeking);

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
