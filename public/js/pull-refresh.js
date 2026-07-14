/* Pull-to-refresh for touch devices. When the page is scrolled to the top and
   the user pulls down past a threshold, calls window.onPullRefresh() (which
   the page sets to re-fetch + re-render). Falls back to a full reload. */

(function () {
  if (!("ontouchstart" in window)) return;

  const THRESHOLD = 64;
  const MAX_PULL = 96;
  const RESISTANCE = 0.5;

  let startY = 0;
  let distance = 0;
  let pulling = false;
  let refreshing = false;

  const indicator = document.createElement("div");
  indicator.className = "pull-refresh";
  indicator.setAttribute("aria-hidden", "true");
  const spinner = document.createElement("span");
  spinner.className = "pull-refresh-spinner";
  indicator.appendChild(spinner);
  document.body.appendChild(indicator);

  function place(px) {
    indicator.style.transform = `translateY(${px}px)`;
    indicator.style.opacity = String(Math.min(px / THRESHOLD, 1));
  }

  function reset() {
    pulling = false;
    distance = 0;
    indicator.classList.remove("ready");
    indicator.style.transition = "transform 200ms ease, opacity 200ms ease";
    place(0);
    window.setTimeout(() => { indicator.style.transition = ""; }, 220);
  }

  async function trigger() {
    refreshing = true;
    indicator.classList.remove("ready");
    indicator.classList.add("refreshing");
    indicator.style.transition = "transform 200ms ease";
    indicator.style.transform = `translateY(${THRESHOLD}px)`;
    indicator.style.opacity = "1";

    try {
      if (typeof window.onPullRefresh === "function") {
        await window.onPullRefresh();
      } else {
        window.location.reload();
        return;
      }
    } catch (error) {
      console.error(error);
    } finally {
      indicator.classList.remove("refreshing");
      refreshing = false;
      reset();
    }
  }

  window.addEventListener("touchstart", (event) => {
    if (refreshing) return;
    if (window.scrollY <= 0 && event.touches.length === 1) {
      startY = event.touches[0].clientY;
      pulling = true;
      indicator.style.transition = "";
    } else {
      pulling = false;
    }
  }, { passive: true });

  window.addEventListener("touchmove", (event) => {
    if (!pulling || refreshing) return;
    const dy = event.touches[0].clientY - startY;
    if (dy <= 0 || window.scrollY > 0) {
      pulling = false;
      place(0);
      return;
    }
    distance = Math.min(dy * RESISTANCE, MAX_PULL);
    place(distance);
    indicator.classList.toggle("ready", distance >= THRESHOLD);
    event.preventDefault(); // hold the page while pulling; blocks overscroll
  }, { passive: false });

  window.addEventListener("touchend", () => {
    if (refreshing || !pulling) return;
    if (distance >= THRESHOLD) trigger();
    else reset();
  }, { passive: true });
})();
