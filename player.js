const player = videojs(
  "video",
  {
    autoplay: false,
    controls: true,
    fluid: true,
    inactivityTimeout: 2200,
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
    // 明确保持初始暂停，避免浏览器扩展恢复上次播放。
    player.pause();
  },
);

const playerWrap = document.querySelector("#playerWrap");

player.on("play", () => playerWrap.classList.add("is-playing"));
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
