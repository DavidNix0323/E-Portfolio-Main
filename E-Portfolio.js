window.addEventListener("DOMContentLoaded", () => {
  // --- state ---
  let isModalOpen = false;
  let contrastToggle = false;
  const scaleFactor = 1 / 20;
  const gravityStrength = 0.1;
  const damping = 0.9;

  const shapeStates = [];
  let held = null;
  let velocity = { x: 0, y: 0 };
  let lastMouse = { x: 0, y: 0 };
  let gravityGunActive = false;
  let gunVisualState = "outline";
  let unequipMode = "outline";

  // physics objects
  const physicsObjects = new Map();

  // --- elements ---
  const gunImg = document.getElementById("gravityGunImage");
  const cursorImg = document.getElementById("gravityGunCursor");
  const gravityGunCard = document.querySelector(".gravity-gun-card");
  const gravityGunTrigger = document.querySelector("#gravityGunTrigger");
  const gravgunZone = document.querySelector("#gravgun");

  // --- assets ---
  const gunStates = {
    outline: "./assets/gravgun-outline.png",
    hover: "./assets/gravgun-hover.png",
    inset: "./assets/gravgun-inset.png",
    open: "./assets/gravgun_vm_open.png",
    close: "./assets/gravgun_vm_close.png",
  };

  // --- muzzle anchor ---
  const MUZZLE_ANCHOR = { xRatio: 0.78, yRatio: 0.58 };
  const HOLD_DISTANCE = 56;
  const GUN_FACING = { x: 1, y: 0 };

  // --- store original positions once (keep % values from HTML) ---
  const originalPositions = new Map();

  document.querySelectorAll(".physElement").forEach((el) => {
    // ✅ Always read the authored percentage values from inline styles or data attributes
    const left = el.getAttribute("data-left") || el.style.left || "0%";
    const top = el.getAttribute("data-top") || el.style.top || "0%";

    // Save as percentages (not px), so we can restore them later on unequip
    originalPositions.set(el, { left, top });
  });

  // --- helpers ---
  function setGunState(state) {
    if (!gunImg || !gunStates[state]) return;
    gunImg.src = gunStates[state];
    gunVisualState = state;
  }

  function showCursorGun(src) {
    cursorImg.src = src;
    cursorImg.style.display = "block";
    cursorImg.style.mixBlendMode = "normal";
    cursorImg.style.filter = "drop-shadow(0 0 12px rgba(0,0,0,0.45))";
    cursorImg.style.zIndex = "3000";
    cursorImg.style.pointerEvents = "none";
    document.body.style.cursor = "none";
  }

  function hideCursorGun() {
    cursorImg.style.display = "none";
    document.body.style.cursor = "default";
  }

  // --- reset back to authored % positions on unequip ---
  function resetPhysElementsToRest() {
    gravgunZone?.querySelectorAll(".physElement").forEach((el) => {
      el.classList.remove("draggable", "dragging", "fired");
      el.classList.add("resting");

      const orig = originalPositions.get(el);
      if (orig) {
        // Smooth float-back into original % coords
        el.style.transition =
          "left 0.6s ease, top 0.6s ease, transform 0.6s ease";

        // ⬇️ Return them to authored state
        el.style.position = "absolute";
        el.style.left = orig.left;
        el.style.top = orig.top;
        el.style.margin = "";
        el.style.transform = "";
        el.style.zIndex = "";
      }

      setTimeout(() => {
        el.style.transition = "";
        physicsObjects.delete(el);
      }, 650);
    });
  }

  function unequipGun() {
    gravityGunActive = false;
    setGunState(unequipMode === "hover" ? "hover" : "outline");
    hideCursorGun();
    document.body.classList.remove("physGunEquipped", "holding");
    resetPhysElementsToRest();
    gravgunZone?.classList.remove("gravgun-active");
    gravityGunTrigger?.classList.remove("active");
  }

  // --- modal toggle ---
  window.toggleModal = function (force) {
    if (typeof force === "boolean") {
      isModalOpen = force;
    } else {
      isModalOpen = !isModalOpen;
    }
    document.body.classList.toggle("modal--open", isModalOpen);
  };

  // --- background parallax ---
  window.moveBackground = function (event) {
    const shapes = document.querySelectorAll(".shape");
    if (shapes.length !== shapeStates.length) {
      shapeStates.length = 0;
      shapes.forEach(() => {
        shapeStates.push({ x: 0, y: 0, vx: 0, vy: 0 });
      });
    }

    const mouseX = event.clientX * scaleFactor;
    const mouseY = event.clientY * scaleFactor;

    shapes.forEach((shape, i) => {
      const state = shapeStates[i];
      const direction = i % 2 === 0 ? 1 : -1;

      const dx = mouseX * direction - state.x;
      const dy = mouseY * direction - state.y;

      state.vx += dx * gravityStrength;
      state.vy += dy * gravityStrength;

      state.vx *= damping;
      state.vy *= damping;

      state.x += state.vx;
      state.y += state.vy;

      shape.style.transform = `translate(${state.x}px, ${state.y}px) rotate(${
        state.vx * 0.1
      }rad)`;
    });
  };

  // --- theme toggle ---
  window.toggleContrast = function () {
    contrastToggle = !contrastToggle;
    document.body.classList.toggle("dark-theme", contrastToggle);
    if (contrastToggle) {
      window.removeEventListener("pointermove", moveBackground);
    } else {
      window.addEventListener("pointermove", moveBackground);
    }
  };

  // --- hover preview ---
  if (gravityGunCard) {
    gravityGunCard.addEventListener("mouseenter", () => {
      if (!gravityGunActive) setGunState("hover");
    });
    gravityGunCard.addEventListener("mouseleave", () => {
      if (!gravityGunActive) setGunState("outline");
    });
  }

  // --- click trigger: toggle equip/unequip ---
  gravityGunTrigger?.addEventListener("click", () => {
    if (!gravityGunActive) {
      gravityGunActive = true;
      setGunState("inset");
      showCursorGun(gunStates.close);

      document.body.classList.add("physGunEquipped");
      gravityGunTrigger.classList.add("active");

      gravgunZone?.querySelectorAll(".physElement").forEach((el) => {
        const rect = el.getBoundingClientRect();
        const vwOffsetX = window.scrollX;
        const vwOffsetY = window.scrollY;

        el.classList.add("draggable");
        el.classList.remove("resting");

        // convert to px-based absolute position while equipped
        el.style.position = "absolute";
        el.style.left = `${rect.left + vwOffsetX}px`;
        el.style.top = `${rect.top + vwOffsetY}px`;
        el.style.margin = "0";
        el.style.transform = "none";
        el.style.zIndex = "2000";

        // Hover listeners
        el.onmouseenter = () => {
          if (gravityGunActive && !held) showCursorGun(gunStates.open);
        };
        el.onmouseleave = () => {
          if (gravityGunActive && !held) showCursorGun(gunStates.close);
        };
      });

      gravgunZone?.classList.add("gravgun-active");
    } else {
      unequipMode = "hover";
      unequipGun();
    }
  });
  // --- mobile touch support ---
if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
  let longPressTimer = null;
  let touchOffset = { x: 0, y: 0 };
  let touchHeld = null;
  let velocity = { x: 0, y: 0 };
  let lastMouse = { x: 0, y: 0 };

  gravgunZone.addEventListener("touchstart", (e) => {
    if (!gravityGunActive) return;
    const touch = e.touches[0];
    lastMouse = { x: touch.clientX, y: touch.clientY };

    const target = e.target.closest(".physElement");

    longPressTimer = setTimeout(() => {
      if (target && gravgunZone.contains(target)) {
        touchHeld = target;
        const rect = touchHeld.getBoundingClientRect();
        touchOffset = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };

        touchHeld.classList.add("dragging");
        touchHeld.style.position = "fixed";
        touchHeld.style.pointerEvents = "none";
        touchHeld.style.zIndex = "2000";
        document.body.classList.add("holding");
        setGunState("open");
        showCursorGun(gunStates.open);
      }
    }, 400); // long press threshold

    e.preventDefault();
  });

  gravgunZone.addEventListener("touchmove", (e) => {
    clearTimeout(longPressTimer);
    if (!gravityGunActive || !touchHeld) return;

    const touch = e.touches[0];
    const dx = touch.clientX - lastMouse.x;
    const dy = touch.clientY - lastMouse.y;
    velocity = { x: dx, y: dy };

    touchHeld.style.left = touch.clientX - touchOffset.x + "px";
    touchHeld.style.top = touch.clientY - touchOffset.y + "px";

    lastMouse = { x: touch.clientX, y: touch.clientY };
    e.preventDefault();
  });

  gravgunZone.addEventListener("touchend", () => {
    clearTimeout(longPressTimer);
    if (!touchHeld) return;

    let x = lastMouse.x - touchOffset.x;
    let y = lastMouse.y - touchOffset.y;
    let vx = velocity.x * 5;
    let vy = velocity.y * 5;

    // --- recoil FX ---
    touchHeld.style.transition = "transform 0.1s ease";
    touchHeld.style.transform = `translate(${x}px, ${y}px) scale(1.2)`;
    setTimeout(() => {
      touchHeld.style.transform = `translate(${x}px, ${y}px) scale(1)`;
    }, 100);

    // --- optional trail burst ---
    if (typeof spawnTrailBurst === "function") {
      spawnTrailBurst(x, y, vx, vy);
    }

    // --- optional launch sound ---
    if (typeof playLaunchSound === "function") {
      playLaunchSound();
    }

    const launch = () => {
      vx *= 0.95;
      vy *= 0.95;
      x += vx;
      y += vy;
      touchHeld.style.transform = `translate(${x}px, ${y}px)`;
      if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
        requestAnimationFrame(launch);
      } else {
        touchHeld.style.pointerEvents = "auto";
        addPhysicsObject(touchHeld, x, y, vx, vy);

        // --- optional snap zone logic ---
        const snapZone = document.querySelector(".snapZone");
        if (snapZone) {
          const zoneRect = snapZone.getBoundingClientRect();
          if (
            x > zoneRect.left &&
            x < zoneRect.right &&
            y > zoneRect.top &&
            y < zoneRect.bottom
          ) {
            snapZone.appendChild(touchHeld);
            touchHeld.style.position = "relative";
            touchHeld.style.left = "0";
            touchHeld.style.top = "0";
            touchHeld.style.transform = "none";

            // --- optional snap zone highlight ---
            snapZone.classList.add("highlight");
            setTimeout(() => snapZone.classList.remove("highlight"), 300);
          }
        }
      }
    };

    touchHeld.classList.remove("dragging");
    launch();
    touchHeld = null;
    document.body.classList.remove("holding");
    setGunState("close");
    showCursorGun(gunStates.close);
  });
}

  // --- ESC to unequip ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gravityGunActive) {
      unequipMode = "outline";
      unequipGun();
    }
  });

  // --- physics ---
  function wrapToViewport(obj) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (obj.x < -obj.width) obj.x = vw;
    if (obj.x > vw) obj.x = -obj.width;
    if (obj.y < -obj.height) obj.y = vh;
    if (obj.y > vh) obj.y = -obj.height;
  }

  function addPhysicsObject(el, x, y, vx, vy) {
    physicsObjects.set(el, {
      x,
      y,
      vx,
      vy,
      width: el.offsetWidth,
      height: el.offsetHeight,
    });
  }

  function updatePhysics() {
    physicsObjects.forEach((obj, el) => {
      obj.x += obj.vx;
      obj.y += obj.vy;
      obj.vx *= 0.992;
      obj.vy *= 0.992;
      wrapToViewport(obj);
      el.style.left = `${obj.x}px`;
      el.style.top = `${obj.y}px`;
    });

    // collision
    const entries = Array.from(physicsObjects.entries());
    for (let i = 0; i < entries.length; i++) {
      const [elA, a] = entries[i];
      for (let j = i + 1; j < entries.length; j++) {
        const [elB, b] = entries[j];
        if (
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
        ) {
          const tvx = a.vx,
            tvy = a.vy;
          a.vx = b.vx;
          a.vy = b.vy;
          b.vx = tvx;
          b.vy = tvy;
          if (a.x < b.x) {
            a.x -= 6;
            b.x += 6;
          } else {
            a.x += 6;
            b.x -= 6;
          }
        }
      }
    }
    requestAnimationFrame(updatePhysics);
  }
  requestAnimationFrame(updatePhysics);
  // --- particle trail canvas ---
  const canvas = document.getElementById("particleCanvas");
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // --- particle state ---
  const particles = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: 0,
    vy: 0,
  }));

  function noise(x, y) {
    return Math.sin(x * 0.01 + y * 0.01);
  }

  // --- particle animation control ---
  let resumeHoverActive = true;
  let isAnimating = false;

  window.toggleParticleTrail = function (force) {
    resumeHoverActive = typeof force === "boolean" ? force : !resumeHoverActive;
    if (resumeHoverActive) animateParticles();
  };

  function animateParticles() {
    if (!resumeHoverActive || isAnimating) return;
    isAnimating = true;

    function loop() {
      if (!resumeHoverActive) {
        isAnimating = false;
        return;
      }

      const isDark = document.body.classList.contains("dark-theme");
      ctx.fillStyle = isDark
        ? "rgba(0, 0, 0, 0.1)"
        : "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        const angle = noise(p.x, p.y) * Math.PI * 2;
        p.vx += Math.cos(angle) * 0.5;
        p.vy += Math.sin(angle) * 0.5;

        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "cyan" : "blue";
        ctx.fill();
      });

      requestAnimationFrame(loop);
    }

    loop();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") animateParticles();
  });

  animateParticles();

  // === Marquee Particle Extension ===
  function initMarqueeTrail() {
    const marqueeCard = document.querySelector(".anim__card:nth-child(6)");
    const marqueeTrack = marqueeCard?.querySelector(".marquee-track");
    if (!marqueeTrack) return;

    marqueeTrack.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (resumeHoverActive) {
        particles.push({ x, y, vx: 0, vy: 0 });
      }
    });

    marqueeTrack.addEventListener("mouseenter", () => {
      pulseDisplacement(); // Optional ripple sync
    });

    let marqueeLoopActive = true;

    function spawnMarqueeParticles() {
      if (!resumeHoverActive || !marqueeLoopActive) return;

      const rect = canvas.getBoundingClientRect();
      const trackRect = marqueeTrack.getBoundingClientRect();

      const x = trackRect.left + Math.random() * trackRect.width;
      const y = trackRect.top + trackRect.height / 2;

      particles.push({ x: x - rect.left, y: y - rect.top, vx: 0, vy: 0 });
      if (particles.length > 300) particles.splice(0, 50);

      setTimeout(spawnMarqueeParticles, 120);
    }

    spawnMarqueeParticles();
  }

  initMarqueeTrail();

  // --- blob morph animation ---
  gsap.registerPlugin(MorphSVGPlugin);

  const blob = document.getElementById("blobPath");
  const blobShapes = [
    "M300,300 C400,200 500,400 300,500 C100,400 200,200 300,300 Z",
    "M300,300 C450,150 550,450 300,550 C50,450 150,150 300,300 Z",
    "M300,300 C350,100 500,500 300,600 C100,500 150,100 300,300 Z",
    "M300,300 C400,250 500,350 300,450 C100,350 200,250 300,300 Z",
  ];

  let morphIndex = 0;
  let morphActive = true;

  window.toggleBlobMorph = function (force) {
    morphActive = typeof force === "boolean" ? force : !morphActive;
    if (morphActive) startBlobMorph();
  };

  function startBlobMorph() {
    if (!blob || !morphActive) return;
    gsap.to(blob, {
      duration: 3,
      ease: "power2.inOut",
      morphSVG: blobShapes[morphIndex % blobShapes.length],
      onComplete: () => {
        morphIndex++;
        pulseDisplacement(); // 🔁 Sync ripple with morph
        startBlobMorph();
      },
    });
  }

  startBlobMorph();

  // --- resume tilt logic ---
  document.querySelectorAll(".resume-tilt .tilt-card").forEach((card) => {
    const inner = card.querySelector(".tilt-inner");
    if (!inner) return;

    const maxTilt = 35;
    const scale = 1.07;

    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const rotateY = (x / rect.width - 0.5) * maxTilt * -2;
      const rotateX = (y / rect.height - 0.5) * maxTilt * 2;

      inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
    });

    card.addEventListener("pointerleave", () => {
      inner.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
    });
  });

  // --- displacement SVG logic ---
  (function initDisplacementEffect() {
    const svg = document.querySelector(".displacement-svg");
    const turbulence = svg?.querySelector("feTurbulence");
    if (!svg || !turbulence) return;

    // Pointer-driven distortion
    svg.addEventListener("pointermove", (e) => {
      const freq = 0.02 + (e.clientX / window.innerWidth) * 0.05;
      turbulence.setAttribute("baseFrequency", freq.toFixed(3));
    });

    svg.addEventListener("pointerleave", () => {
      turbulence.setAttribute("baseFrequency", "0.02");
    });

    // Ambient ripple loop
    let t = 0;
    function animateTurbulence() {
      t += 0.01;
      const freq = 0.02 + Math.sin(t) * 0.015;
      turbulence.setAttribute("baseFrequency", freq.toFixed(3));
      requestAnimationFrame(animateTurbulence);
    }

    animateTurbulence();

    // Pulse effect for blob sync
    window.pulseDisplacement = function () {
      turbulence.setAttribute("baseFrequency", "0.08");
      setTimeout(() => turbulence.setAttribute("baseFrequency", "0.02"), 300);
    };
  })();

  // --- muzzle pos ---
  function getMuzzlePosition() {
    const r = cursorImg.getBoundingClientRect();
    const mx = r.left + r.width * MUZZLE_ANCHOR.xRatio;
    const my = r.top + r.height * MUZZLE_ANCHOR.yRatio;
    return { x: mx, y: my };
  }

  // --- left click: grab ---
  document.addEventListener("mousedown", (e) => {
    if (!gravityGunActive || e.button !== 0) return;
    const target = e.target.closest(".physElement");
    if (!target) return;

    e.preventDefault();
    held = target;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;

    held.classList.add("dragging", "recoil");
    held.style.zIndex = "2000";
    held.style.cursor = "none";
    showCursorGun(gunStates.open);
    document.body.classList.add("holding");

    physicsObjects.delete(held);
  });

  // --- right click: fire ---
  document.addEventListener("contextmenu", (e) => {
    if (!gravityGunActive) return;
    e.preventDefault();

    let target = held || e.target.closest(".physElement");
    if (!target) return;

    if (held === target) {
      held.classList.remove("dragging", "recoil");
      document.body.classList.remove("holding");
      held = null;
      showCursorGun(gunStates.close);
    }

    const { x: muzzleX, y: muzzleY } = getMuzzlePosition();
    let dx = e.clientX - muzzleX;
    let dy = e.clientY - muzzleY;
    const len = Math.max(Math.hypot(dx, dy), 1);
    dx /= len;
    dy /= len;
    let vx = dx * 420; // 💥 stronger blast
    let vy = dy * 420;

    target.classList.add("fired");

    let x = muzzleX - target.offsetWidth / 2;
    let y = muzzleY - target.offsetHeight / 2;
    target.style.left = `${x}px`;
    target.style.top = `${y}px`;

    addPhysicsObject(target, x, y, vx, vy);
    setTimeout(() => target.classList.remove("fired"), 400);
  });

  // --- drag follow ---
  document.addEventListener("mousemove", (e) => {
    if (gravityGunActive) {
      cursorImg.style.left = `${e.clientX}px`;
      cursorImg.style.top = `${e.clientY}px`;
      cursorImg.style.transform = "translate(-50%, -50%)";
    }
    if (!held) return;
    const { x: muzzleX, y: muzzleY } = getMuzzlePosition();
    const objX = muzzleX + GUN_FACING.x * HOLD_DISTANCE - held.offsetWidth / 2;
    const objY = muzzleY + GUN_FACING.y * HOLD_DISTANCE - held.offsetHeight / 2;
    velocity.x = e.clientX - lastMouse.x;
    velocity.y = e.clientY - lastMouse.y;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
    held.style.left = `${objX}px`;
    held.style.top = `${objY}px`;
    held.style.zIndex = "2000";
  });

  // --- release ---
  document.addEventListener("mouseup", (e) => {
    if (e.button !== 0 || !held) return;
    let x = parseFloat(held.style.left) || 0;
    let y = parseFloat(held.style.top) || 0;
    let vx = velocity.x * 4.5;
    let vy = velocity.y * 4.5;
    const released = held;
    released.classList.remove("recoil");
    addPhysicsObject(released, x, y, vx, vy);
    showCursorGun(gunStates.close);
    document.body.classList.remove("holding");
    held = null;
  });

  // --- debug ---
  const debug = document.createElement("div");
  debug.style.position = "fixed";
  debug.style.bottom = "10px";
  debug.style.right = "10px";
  debug.style.padding = "6px 12px";
  debug.style.fontSize = "12px";
  debug.style.background = "#000";
  debug.style.color = "#0ff";
  debug.style.zIndex = "99999";
  debug.style.borderRadius = "6px";
  debug.style.fontFamily = "monospace";
  debug.innerText = "Gravity Gun: OFF";
  document.body.appendChild(debug);

  setInterval(() => {
    debug.innerText = gravityGunActive
      ? document.body.classList.contains("holding")
        ? "Gravity Gun: HOLDING"
        : "Gravity Gun: EQUIPPED"
      : "Gravity Gun: OFF";
  }, 300);
});
