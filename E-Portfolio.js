let isModalOpen = false;
let contrastToggle = false;
const scaleFactor = 1 / 20;
const gravityStrength = 0.1; // tweak for intensity
const damping = 0.9; // smooth out motion

const shapeStates = [];

function initShapes() {
  const shapes = document.querySelectorAll(".shape");
  shapeStates.length = 0;
  shapes.forEach(() => {
    shapeStates.push({ x: 0, y: 0, vx: 0, vy: 0 });
  });
}

function moveBackground(event) {
  const shapes = document.querySelectorAll(".shape");
  const mouseX = event.clientX * scaleFactor;
  const mouseY = event.clientY * scaleFactor;

  shapes.forEach((shape, i) => {
    const state = shapeStates[i];
    const direction = i % 2 === 0 ? 1 : -1;

    // Gravity Gun physics
    const dx = mouseX * direction - state.x;
    const dy = mouseY * direction - state.y;

    state.vx += dx * gravityStrength;
    state.vy += dy * gravityStrength;

    state.vx *= damping;
    state.vy *= damping;

    state.x += state.vx;
    state.y += state.vy;

    shape.style.transform = `translate(${state.x}px, ${state.y}px)`;
  });
}

function toggleContrast() {
  contrastToggle = !contrastToggle;
  document.body.classList.toggle("dark-theme", contrastToggle);
}

function contact(event) {
  event.preventDefault();
  const loading = document.querySelector(".modal__overlay--loading");
  const success = document.querySelector(".modal__overlay--success");

  if (!loading || !success) {
    console.warn("Modal overlays not found");
    return;
  }

  loading.classList.add("modal__overlay--visible");

  emailjs
    .sendForm(
      "service_qtmqytt",
      "template_zvmldnn",
      event.target,
      "uoqjvIdH2TECIGITZ"
    )
    .then(() => {
      loading.classList.remove("modal__overlay--visible");
      success.classList.add("modal__overlay--visible");
    })
    .catch(() => {
      loading.classList.remove("modal__overlay--visible");
      alert(
        "The email service is temporarily unavailable. Please contact me directly at davidnix0323@yahoo.com"
      );
    });
}

function toggleModal() {
  isModalOpen = !isModalOpen;
  document.body.classList.toggle("modal--open", isModalOpen);
}

// Initialize shape states on load
window.addEventListener("DOMContentLoaded", initShapes);
