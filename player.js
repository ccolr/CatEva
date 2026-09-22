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
