/**
 * VideoController
 * Implements the "double video" technique from the spec:
 * - two <video> elements (videoA / videoB) are kept in the DOM
 * - one is always visible ("active"), the other is preloaded with the
 *   next clip and crossfaded in over ~150-250ms
 * - REST_SRC loops continuously while idle/listening
 * - TALKING_SRC plays while NOVA is speaking
 *
 * IMPORTANT: never reload the page / re-point src on the visible video
 * without first preloading on the hidden one — that's what avoids the
 * flash-to-black the spec calls out.
 */
const VideoController = (() => {
  const REST_SRC = "assets/rest.mp4";
  const TALKING_SRC = "assets/talking.mp4";
  const CROSSFADE_MS = 200;

  let videoA = document.getElementById("videoA");
  let videoB = document.getElementById("videoB");
  let activeVideo = videoA;
  let inactiveVideo = videoB;
  let currentState = null; // "rest" | "talking"

  function srcFor(state) {
    return state === "talking" ? TALKING_SRC : REST_SRC;
  }

  function init() {
    videoA.src = REST_SRC;
    videoB.src = TALKING_SRC;
    videoA.classList.add("active");
    videoB.classList.remove("active");
    currentState = "rest";

    // Hardware-accelerated decoding hints where supported.
    [videoA, videoB].forEach((v) => {
      v.setAttribute("playsinline", "");
      v.muted = true;
      v.loop = true;
      v.play().catch(() => {
        // Autoplay can be blocked until first user/voice interaction on
        // some browsers; app.js kicks a play() on first wake event too.
      });
    });
  }

  function setState(state) {
    if (state === currentState) return;
    const targetSrc = srcFor(state);

    setIdle(false);

    // Check if targetSrc matches current inactiveVideo src (supports relative and absolute URLs)
    const currentInactiveSrc = inactiveVideo.getAttribute("src") || inactiveVideo.src || "";
    const needsFreshLoad = !currentInactiveSrc.endsWith(targetSrc);

    function beginCrossfade() {
      const p = inactiveVideo.play();
      if (p) p.catch(() => {});

      inactiveVideo.classList.add("active");
      activeVideo.classList.remove("active");

      // Swap references.
      const prevActive = activeVideo;
      activeVideo = inactiveVideo;
      inactiveVideo = prevActive;

      currentState = state;

      // Pre-buffer the other clip so it's ready for the next switch
      setTimeout(() => {
        const nextNeeded = srcFor(state === "talking" ? "rest" : "talking");
        const inSrc = inactiveVideo.getAttribute("src") || inactiveVideo.src || "";
        if (!inSrc.endsWith(nextNeeded)) {
          inactiveVideo.src = nextNeeded;
          inactiveVideo.load();
        }
      }, CROSSFADE_MS);
    }

    if (needsFreshLoad) {
      inactiveVideo.src = targetSrc;
      inactiveVideo.load();

      let transitioned = false;
      const onReady = () => {
        if (transitioned) return;
        transitioned = true;
        inactiveVideo.removeEventListener("loadeddata", onReady);
        inactiveVideo.removeEventListener("canplay", onReady);
        beginCrossfade();
      };

      inactiveVideo.addEventListener("loadeddata", onReady, { once: true });
      inactiveVideo.addEventListener("canplay", onReady, { once: true });
      // Safety timeout: crossfade after at most 60ms so it never hangs
      setTimeout(onReady, 60);
    } else {
      beginCrossfade();
    }
  }

  function toTalking() {
    setIdle(false);
    setState("talking");
  }

  function toRest() {
    setState("rest");
  }

  function setIdle(isIdle) {
    if (isIdle) {
      inactiveVideo.pause();
    } else if (inactiveVideo.paused) {
      const playPromise = inactiveVideo.play();
      if (playPromise) playPromise.catch(() => {});
    }
  }

  return { init, toTalking, toRest, setIdle };
})();
