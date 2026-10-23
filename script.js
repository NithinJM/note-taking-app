const API = "/api/notes";
const AUTH_API = "/api/auth";
const AUTH_TOKEN_KEY = "noteflow.authToken";

const state = {
  activeFilter: "all",
  activeTag: "all",
  authMode: "login",
  notes: [],
  search: "",
  selectedId: null,
  token: localStorage.getItem(AUTH_TOKEN_KEY),
  user: null
};

const els = {
  accountMenu: document.getElementById("accountMenu"),
  archiveButton: document.getElementById("archiveButton"),
  archivedCount: document.getElementById("archivedCount"),
  allCount: document.getElementById("allCount"),
  authEyebrow: document.getElementById("authEyebrow"),
  authForm: document.getElementById("authForm"),
  authHeading: document.getElementById("authHeading"),
  authPanel: document.getElementById("authPanel"),
  authSubmitText: document.getElementById("authSubmitText"),
  categoryInput: document.getElementById("categoryInput"),
  clearButton: document.getElementById("clearButton"),
  contentInput: document.getElementById("contentInput"),
  deleteButton: document.getElementById("deleteButton"),
  editorHeading: document.getElementById("editorHeading"),
  editorMode: document.getElementById("editorMode"),
  emailInput: document.getElementById("emailInput"),
  filterLabel: document.getElementById("filterLabel"),
  listHeading: document.getElementById("listHeading"),
  logoutButton: document.getElementById("logoutButton"),
  nameField: document.getElementById("nameField"),
  nameInput: document.getElementById("nameInput"),
  newNoteBtn: document.getElementById("newNoteBtn"),
  noteForm: document.getElementById("noteForm"),
  notesList: document.getElementById("notesList"),
  passwordInput: document.getElementById("passwordInput"),
  pinButton: document.getElementById("pinButton"),
  pinnedCount: document.getElementById("pinnedCount"),
  saveButtonText: document.getElementById("saveButtonText"),
  searchInput: document.getElementById("searchInput"),
  statusText: document.getElementById("statusText"),
  tagList: document.getElementById("tagList"),
  tagsInput: document.getElementById("tagsInput"),
  titleInput: document.getElementById("titleInput"),
  toggleAuthMode: document.getElementById("toggleAuthMode"),
  userName: document.getElementById("userName"),
  visibleCount: document.getElementById("visibleCount"),
  workspace: document.getElementById("workspace")
};

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function getAuthHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function setNavigationEnabled(isEnabled) {
  els.newNoteBtn.disabled = !isEnabled;
  els.searchInput.disabled = !isEnabled;
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.disabled = !isEnabled;
  });
}

function setAccountDisplay() {
  els.accountMenu.hidden = !state.user;
  els.userName.textContent = state.user?.name || state.user?.email || "";
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isRegister = mode === "register";

  els.nameField.hidden = !isRegister;
  els.nameInput.required = isRegister;
  els.authEyebrow.textContent = isRegister ? "Create account" : "Welcome back";
  els.authHeading.textContent = isRegister ? "Create your NoteFlow account" : "Sign in to NoteFlow";
  els.authSubmitText.textContent = isRegister ? "Create account" : "Sign in";
  els.toggleAuthMode.textContent = isRegister ? "Already have an account?" : "Create an account";
  els.passwordInput.autocomplete = isRegister ? "new-password" : "current-password";
  refreshIcons();
}

function resetEditorDisplay() {
  state.selectedId = null;
  els.noteForm.reset();
  els.editorMode.textContent = "New note";
  els.editorHeading.textContent = "Capture something useful";
  els.saveButtonText.textContent = "Save note";
  [els.pinButton, els.archiveButton, els.deleteButton].forEach((button) => {
    button.disabled = true;
    button.classList.remove("is-active");
    button.setAttribute("aria-pressed", "false");
  });
}

function showAuthGate(message = "Sign in to continue.") {
  state.notes = [];
  state.user = null;
  resetEditorDisplay();
  els.workspace.hidden = true;
  els.authPanel.hidden = false;
  els.searchInput.value = "";
  state.search = "";
  setNavigationEnabled(false);
  setAccountDisplay();
  render();
  setStatus(message);
}

function showWorkspace() {
  els.authPanel.hidden = true;
  els.workspace.hidden = false;
  setNavigationEnabled(true);
  setAccountDisplay();
}

function clearAuth(message = "Signed out.") {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  state.token = null;
  showAuthGate(message);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function getSelectedNote() {
  return state.notes.find((note) => note.id === state.selectedId);
}

function getTagValues() {
  return els.tagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function getVisibleNotes() {
  const query = state.search.toLowerCase();

  return state.notes.filter((note) => {
    const matchesFilter =
      (state.activeFilter === "all" && !note.isArchived) ||
      (state.activeFilter === "pinned" && note.isPinned && !note.isArchived) ||
      (state.activeFilter === "archived" && note.isArchived);
    const matchesTag = state.activeTag === "all" ||
      note.tags.some((tag) => tag.toLowerCase() === state.activeTag);
    const searchable = [note.title, note.content, note.category, note.tags.join(" ")]
      .join(" ")
      .toLowerCase();

    return matchesFilter && matchesTag && searchable.includes(query);
  });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && state.token) clearAuth("Please sign in again.");
    throw new Error(data.message || "Request failed");
  }

  return data;
}

async function loadNotes() {
  if (!state.token) {
    showAuthGate();
    return;
  }

  setStatus("Loading notes...");
  state.notes = await requestJson(API);

  if (!state.selectedId && state.notes.length > 0) {
    fillEditor(state.notes[0]);
  } else if (state.selectedId) {
    const selected = getSelectedNote();
    selected ? fillEditor(selected) : startNewNote(false);
  }

  render();
  setStatus("Ready");
}

function render() {
  renderCounts();
  renderFilters();
  renderTags();
  renderNotesList();
  refreshIcons();
}

function renderCounts() {
  const activeNotes = state.notes.filter((note) => !note.isArchived);
  els.allCount.textContent = activeNotes.length;
  els.pinnedCount.textContent = activeNotes.filter((note) => note.isPinned).length;
  els.archivedCount.textContent = state.notes.filter((note) => note.isArchived).length;
}

function renderFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === state.activeFilter);
  });

  const labels = { all: "All notes", pinned: "Pinned", archived: "Archive" };
  els.filterLabel.textContent = labels[state.activeFilter];
  els.listHeading.textContent = state.activeTag === "all" ? "Notes" : `#${state.activeTag}`;
}

function renderTags() {
  const tagCounts = new Map();

  state.notes.filter((note) => !note.isArchived).forEach((note) => {
    note.tags.forEach((tag) => {
      const key = tag.toLowerCase();
      tagCounts.set(key, { label: tag, count: (tagCounts.get(key)?.count || 0) + 1 });
    });
  });

  els.tagList.innerHTML = "";
  els.tagList.appendChild(createTagButton("All", "all", state.notes.filter((note) => !note.isArchived).length));
  [...tagCounts.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label)).forEach(([key, value]) => {
    els.tagList.appendChild(createTagButton(value.label, key, value.count));
  });
}

function createTagButton(label, value, count) {
  const button = createElement("button", "tag-chip", `${label} ${count}`);
  button.type = "button";
  button.dataset.tag = value;
  button.classList.toggle("is-active", state.activeTag === value);
  button.addEventListener("click", () => {
    state.activeTag = value;
    render();
  });
  return button;
}

function renderNotesList() {
  const visibleNotes = getVisibleNotes();
  els.visibleCount.textContent = visibleNotes.length;
  els.notesList.innerHTML = "";

  if (visibleNotes.length === 0) {
    els.notesList.appendChild(createElement("div", "empty-state", "No notes found."));
    return;
  }

  visibleNotes.forEach((note) => els.notesList.appendChild(createNoteCard(note)));
}

function createNoteCard(note) {
  const card = createElement("button", "note-card");
  card.type = "button";
  card.dataset.noteId = note.id;
  card.classList.toggle("is-active", note.id === state.selectedId);

  const header = createElement("div", "note-card-header");
  header.appendChild(createElement("h3", "", note.title));
  if (note.isPinned) header.appendChild(createElement("span", "state-pill", "Pinned"));

  const meta = createElement("div", "note-meta");
  meta.appendChild(createElement("span", "", note.category));
  meta.appendChild(createElement("span", "", formatDate(note.updatedAt)));

  const tagRow = createElement("div", "tag-row");
  note.tags.slice(0, 4).forEach((tag) => tagRow.appendChild(createElement("span", "note-tag", tag)));

  card.appendChild(header);
  card.appendChild(createElement("p", "", note.content.trim() ? note.content.trim().slice(0, 130) : "Empty note"));
  card.appendChild(meta);
  if (note.tags.length > 0) card.appendChild(tagRow);
  return card;
}

function fillEditor(note) {
  state.selectedId = note.id;
  els.titleInput.value = note.title;
  els.categoryInput.value = note.category;
  els.tagsInput.value = note.tags.join(", ");
  els.contentInput.value = note.content;
  els.editorMode.textContent = note.isArchived ? "Archived note" : "Editing";
  els.editorHeading.textContent = note.title;
  els.saveButtonText.textContent = "Update note";
  els.pinButton.disabled = false;
  els.archiveButton.disabled = false;
  els.deleteButton.disabled = false;
  els.pinButton.classList.toggle("is-active", note.isPinned);
  els.archiveButton.classList.toggle("is-active", note.isArchived);
  els.pinButton.setAttribute("aria-pressed", String(note.isPinned));
  els.archiveButton.setAttribute("aria-pressed", String(note.isArchived));
}

function startNewNote(shouldFocus = true) {
  if (!state.token) {
    showAuthGate("Sign in to create notes.");
    return;
  }

  resetEditorDisplay();
  renderNotesList();
  refreshIcons();
  if (shouldFocus) els.titleInput.focus();
}

async function saveNote(event) {
  event.preventDefault();
  const title = els.titleInput.value.trim();
  const content = els.contentInput.value.trim();

  if (!title && !content) {
    setStatus("Add a title or content first.");
    return;
  }

  const existing = getSelectedNote();
  const payload = {
    title: title || "Untitled note",
    category: els.categoryInput.value.trim() || "General",
    tags: getTagValues(),
    content,
    isPinned: existing?.isPinned || false,
    isArchived: existing?.isArchived || false
  };

  try {
    setStatus(existing ? "Updating note..." : "Saving note...");
    const saved = existing
      ? await requestJson(`${API}/${existing.id}`, { method: "PUT", body: JSON.stringify(payload) })
      : await requestJson(API, { method: "POST", body: JSON.stringify(payload) });

    state.selectedId = saved.id;
    await loadNotes();
    fillEditor(saved);
    setStatus(existing ? "Note updated." : "Note saved.");
  } catch (err) {
    setStatus(err.message);
  }
}

async function updateSelectedNote(changes, message) {
  const note = getSelectedNote();
  if (!note) return;

  try {
    setStatus(message);
    const updated = await requestJson(`${API}/${note.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...note, ...changes })
    });
    state.selectedId = updated.id;
    await loadNotes();
    fillEditor(updated);
  } catch (err) {
    setStatus(err.message);
  }
}

async function deleteSelectedNote() {
  const note = getSelectedNote();
  if (!note || !confirm(`Delete "${note.title}"?`)) return;

  try {
    setStatus("Deleting note...");
    await requestJson(`${API}/${note.id}`, { method: "DELETE" });
    state.selectedId = null;
    await loadNotes();
    startNewNote(false);
    setStatus("Note deleted.");
  } catch (err) {
    setStatus(err.message);
  }
}

async function handleAuth(event) {
  event.preventDefault();

  const payload = {
    email: els.emailInput.value.trim(),
    password: els.passwordInput.value
  };

  if (state.authMode === "register") payload.name = els.nameInput.value.trim();

  try {
    setStatus(state.authMode === "register" ? "Creating account..." : "Signing in...");
    const data = await requestJson(`${AUTH_API}/${state.authMode === "register" ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    state.token = data.token;
    state.user = data.user;
    els.authForm.reset();
    showWorkspace();
    await loadNotes();
  } catch (err) {
    setStatus(err.message);
  }
}

async function loadCurrentUser() {
  if (!state.token) {
    showAuthGate();
    return false;
  }

  try {
    const data = await requestJson(`${AUTH_API}/me`);
    state.user = data.user;
    return true;
  } catch (err) {
    clearAuth("Please sign in again.");
    return false;
  }
}

async function initialize() {
  setAuthMode("login");

  if (!state.token) {
    showAuthGate();
    return;
  }

  setStatus("Checking sign in...");
  if (await loadCurrentUser()) {
    showWorkspace();
    await loadNotes();
  }
}

els.authForm.addEventListener("submit", handleAuth);
els.toggleAuthMode.addEventListener("click", () => setAuthMode(state.authMode === "login" ? "register" : "login"));
els.logoutButton.addEventListener("click", () => clearAuth());
els.noteForm.addEventListener("submit", saveNote);
els.newNoteBtn.addEventListener("click", () => startNewNote());
els.clearButton.addEventListener("click", () => startNewNote());
els.deleteButton.addEventListener("click", deleteSelectedNote);
els.pinButton.addEventListener("click", () => {
  const note = getSelectedNote();
  updateSelectedNote({ isPinned: !note?.isPinned }, note?.isPinned ? "Unpinning note..." : "Pinning note...");
});
els.archiveButton.addEventListener("click", () => {
  const note = getSelectedNote();
  updateSelectedNote({ isArchived: !note?.isArchived }, note?.isArchived ? "Restoring note..." : "Archiving note...");
});
els.notesList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-note-id]");
  if (!card) return;

  const note = state.notes.find((item) => item.id === card.dataset.noteId);
  if (note) {
    fillEditor(note);
    renderNotesList();
    refreshIcons();
  }
});
document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeFilter = button.dataset.filter;
    state.activeTag = "all";
    render();
  });
});
els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderNotesList();
});

initialize().catch((err) => setStatus(err.message));
