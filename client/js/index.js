const socket = io();

const appContainer = document.getElementById("appContainer");
const homeBtn = document.getElementById("homeBtn");
const activeViewLabel = document.getElementById("activeViewLabel");

const PRIMARY_ITEMS = [
  {
    id: "drawing-panel",
    icon: "✏️",
    tag: "Tablet",
    title: "Drawing Panel",
    desc: "Stylus canvas, secret word prompt, skip, and manual scoring"
  },
  {
    id: "dashboard",
    icon: "📺",
    tag: "Smart TV",
    title: "Dashboard",
    desc: "Live broadcast board showing strokes only—word stays hidden"
  }
];

const SECONDARY_ITEMS = [
  {
    id: "team-settings",
    icon: "🏆",
    tag: "Setup",
    title: "Team Settings",
    desc: "Create and manage competing teams"
  },
  {
    id: "provisions",
    icon: "⚡",
    tag: "Stacking",
    title: "Provisions",
    desc: "Ink, time, and skips earned from stacking performance"
  },
  {
    id: "word-bank",
    icon: "📚",
    tag: "Prompts",
    title: "Word Bank",
    desc: "Add and customize drawing words"
  }
];

const ALL_ITEMS = [...PRIMARY_ITEMS, ...SECONDARY_ITEMS];
const viewRegistry = {};

function registerView(name, handlers) {
  viewRegistry[name] = handlers;
}

let currentView = "main-menu";

function renderCard(item) {
  return `
    <button type="button" class="menu-card" data-view="${item.id}">
      <div class="card-top">
        <span class="card-badge">${item.icon}</span>
        <span class="card-tag">${item.tag}</span>
      </div>
      <div class="card-body">
        <span class="menu-title">${item.title}</span>
        <span class="menu-desc">${item.desc}</span>
      </div>
    </button>
  `;
}

function renderMainMenu() {
  activeViewLabel.textContent = "Main Menu";
  appContainer.innerHTML = `
    <div class="menu-hero">
      <h1>stacking-ink</h1>
      <p>Select a live screen for this device or configure game settings below.</p>
    </div>

    <div class="menu-section-label">Live Stage Screens</div>
    <section class="menu-grid-primary" aria-label="Live Stage Screens">
      ${PRIMARY_ITEMS.map(renderCard).join("")}
    </section>

    <div class="menu-section-label">Game Setup &amp; Rules</div>
    <section class="menu-grid-secondary" aria-label="Game Setup">
      ${SECONDARY_ITEMS.map(renderCard).join("")}
    </section>
  `;

  appContainer.querySelectorAll(".menu-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateTo(btn.dataset.view);
    });
  });
}

function renderStubView(item) {
  activeViewLabel.textContent = item.title;
  appContainer.innerHTML = `
    <section class="stub-panel">
      <h2>${item.icon} ${item.title}</h2>
      <p>${item.desc} — ready to wire up modularly next.</p>
    </section>
  `;
}

function navigateTo(viewName) {
  if (currentView && viewRegistry[currentView]?.unmount) {
    viewRegistry[currentView].unmount();
  }

  currentView = viewName;

  if (viewName === "main-menu") {
    renderMainMenu();
    return;
  }

  const registered = viewRegistry[viewName];
  if (registered?.mount) {
    const matched = ALL_ITEMS.find((m) => m.id === viewName);
    activeViewLabel.textContent = matched ? matched.title : viewName;
    appContainer.innerHTML = "";
    registered.mount(appContainer, socket);
    return;
  }

  const fallback = ALL_ITEMS.find((m) => m.id === viewName) || {
    icon: "⚙️",
    title: viewName,
    desc: "Module"
  };
  renderStubView(fallback);
}

homeBtn.addEventListener("click", () => {
  navigateTo("main-menu");
});

window.StackingInkApp = {
  socket,
  registerView,
  navigateTo
};

renderMainMenu();