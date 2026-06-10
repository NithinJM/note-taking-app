const API = "/api/notes";
const AUTH_API = "/api/auth";
const AUTH_TOKEN_KEY = "noteflow.authToken";

const state = {
  activeFilter: "all",
  activeTag: "all",
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
  authPanel: document.getElementById("authPanel"),
  categoryInput: document.getElementById("categoryInput"),
  clearButton: document.getElementById("clearButton"),
  contentInput: document.getElementById("contentInput"),
  deleteButton: document.getElementById("deleteButton"),
  editorHeading: document.getElementById("editorHeading"),
  editorMode: document.getElementById("editorMode"),
  facebookLoginButton: document.getElementById("facebookLoginButton"),
  filterLabel: document.getElementById("filterLabel"),
  googleLoginButton: document.getElementById("googleLoginButton"),
  listHeading: document.getElementById("listHeading"),
  logoutButton: document.getElementById("logoutButton"),
  newNoteBtn: document.getElementById("newNoteBtn"),
  noteForm: document.getElementById("noteForm"),
  notesList: document.getElementById("notesList"),
  pinButton: document.getElementById("pinButton"),
  pinnedCount: document.getElementById("pinnedCount"),
  saveButtonText: document.getElementById("saveButtonText"),
  searchInput: document.getElementById("searchInput"),
  statusText: document.getElementById("statusText"),
  tagList: document.getElementById("tagList"),
  tagsInput: document.getElementById("tagsInput"),
  titleInput: document.getElementById("titleInput"),
  userName: document.getElementById("userName"),
  visibleCount: document.getElementById("visibleCount"),
  workspace: document.getElementById("workspace")
};

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
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
  if (!state.user) {
    els.accountMenu.hidden = true;
    els.userName.textContent = "";
    return;
  }

  els.userName.textContent = state.user.name || state.user.email || "Signed in";
  els.accountMenu.hidden = false;
}

function resetEditorDisplay() {
  state.selectedId = null;
  els.noteForm.reset();
  els.editorMode.textContent = "New note";
  els.editorHeading.textContent = "Capture something useful";
  els.saveButtonText.textContent = "Save note";
  els.pinButton.disabled = true;
  els.archiveButton.disabled = true;
  els.deleteButton.disabled = true;
  els.pinButton.classList.remove("is-active");
  els.archiveButton.classList.remove("is-active");
  els.pinButton.setAttribute("aria-pressed", "false");
  els.archiveButton.setAttribute("aria-pressed", "false");
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

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function createIcon(name) {
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", name);
  return icon;
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
  return els.tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getVisibleNotes() {
  const query = state.search.toLowerCase();

  return state.notes.filter((note) => {
    const matchesFilter =
      (state.activeFilter === "all" && !note.isArchived) ||
      (state.activeFilter === "pinned" && note.isPinned && !note.isArchived) ||
      (state.activeFilter === "archived" && note.isArchived);

    const matchesTag =
      state.activeTag === "all" ||
      note.tags.some((tag) => tag.toLowerCase() === state.activeTag);

    const searchable = [
      note.title,
      note.content,
      note.category,
      note.tags.join(" ")
    ].join(" ").toLowerCase();

    return matchesFilter && matchesTag && searchable.includes(query);
  });
}

async function requestAuth(path, options = {}) {
  const response = await fetch(`${AUTH_API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Authentication failed");
  }

  return response.json();
}

async function requestNote(path = "", options = {}) {
  if (!state.token) {
    throw new Error("Sign in to continue.");
  }

  const response = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearAuth("Please sign in again.");
    }

    throw new Error(error.message || "Request failed");
  }

  return response.json();
}

async function loadNotes() {
  if (!state.token) {
    showAuthGate();
    return;
  }

  setStatus("Loading notes...");
  state.notes = await requestNote();

  if (!state.selectedId && state.notes.length > 0) {
    state.selectedId = state.notes[0].id;
    fillEditor(state.notes[0]);
  } else if (state.selectedId) {
    const selected = getSelectedNote();

    if (selected) {
      fillEditor(selected);
    } else {
      startNewNote(false);
    }
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

  const labels = {
    all: "All notes",
    pinned: "Pinned",
    archived: "Archive"
  };

  els.filterLabel.textContent = labels[state.activeFilter];
  els.listHeading.textContent = state.activeTag === "all"
    ? "Notes"
    : `#${state.activeTag}`;
}

function renderTags() {
  const tagCounts = new Map();

  state.notes
    .filter((note) => !note.isArchived)
    .forEach((note) => {
      note.tags.forEach((tag) => {
        const key = tag.toLowerCase();
        tagCounts.set(key, {
          label: tag,
          count: (tagCounts.get(key)?.count || 0) + 1
        });
      });
    });

  els.tagList.innerHTML = "";
  els.tagList.appendChild(createTagButton("All", "all", state.notes.filter((note) => !note.isArchived).length));

  [...tagCounts.entries()]
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .forEach(([key, value]) => {
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

  visibleNotes.forEach((note) => {
    els.notesList.appendChild(createNoteCard(note));
  });
}

function createNoteCard(note) {
  const card = createElement("button", "note-card");
  card.type = "button";
  card.dataset.noteId = note.id;
  card.classList.toggle("is-active", note.id === state.selectedId);

  const header = createElement("div", "note-card-header");
  header.appendChild(createElement("h3", "", note.title));

  if (note.isPinned) {
    const pinned = createElement("span", "state-pill", "Pinned");
    header.appendChild(pinned);
  }

  const excerpt = note.content.trim()
    ? note.content.trim().slice(0, 130)
    : "Empty note";
  const meta = createElement("div", "note-meta");
  meta.appendChild(createElement("span", "", note.category));
  meta.appendChild(createElement("span", "", formatDate(note.updatedAt)));
  const tagRow = createElement("div", "tag-row");

  note.tags.slice(0, 4).forEach((tag) => {
    tagRow.appendChild(createElement("span", "note-tag", tag));
  });

  card.appendChild(header);
  card.appendChild(createElement("p", "", excerpt));
  card.appendChild(meta);

  if (note.tags.length > 0) {
    card.appendChild(tagRow);
  }

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

  if (shouldFocus) {
    els.titleInput.focus();
  }
}

async function saveNote(event) {
  event.preventDefault();

  if (!state.token) {
    showAuthGate("Sign in to save notes.");
    return;
  }

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
      ? await requestNote(`/${existing.id}`, { method: "PUT", body: JSON.stringify(payload) })
      : await requestNote("", { method: "POST", body: JSON.stringify(payload) });

    state.selectedId = saved.id;
    await loadNotes();
    fillEditor(saved);
    setStatus(existing ? "Note updated." : "Note saved.");
  } catch (err) {
    setStatus(err.message);
  }
}

async function updateSelectedNote(changes, message) {
  if (!state.token) {
    showAuthGate("Sign in to update notes.");
    return;
  }

  const note = getSelectedNote();

  if (!note) {
    return;
  }

  try {
    setStatus(message);
    const updated = await requestNote(`/${note.id}`, {
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
  if (!state.token) {
    showAuthGate("Sign in to delete notes.");
    return;
  }

  const note = getSelectedNote();

  if (!note || !confirm(`Delete "${note.title}"?`)) {
    return;
  }

  try {
    setStatus("Deleting note...");
    await requestNote(`/${note.id}`, { method: "DELETE" });
    state.selectedId = null;
    await loadNotes();
    startNewNote(false);
    setStatus("Note deleted.");
  } catch (err) {
    setStatus(err.message);
  }
}

function handleOAuthRedirect() {
  if (!window.location.hash) {
    return;
  }

  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("auth_token");
  const error = params.get("auth_error");

  if (!token && !error) {
    return;
  }

  window.history.replaceState(null, "", window.location.pathname + window.location.search);

  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    state.token = token;
    setStatus("Signed in.");
    return;
  }

  showAuthGate(error || "Sign in failed.");
}

async function loadCurrentUser() {
  if (!state.token) {
    showAuthGate();
    return false;
  }

  try {
    const data = await requestAuth("/me");
    state.user = data.user;
    return true;
  } catch (err) {
    clearAuth("Please sign in again.");
    return false;
  }
}

async function initialize() {
  handleOAuthRedirect();

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

function startOAuth(provider) {
  setStatus(`Opening ${provider} sign in...`);
  window.location.href = `${AUTH_API}/${provider}`;
}

els.googleLoginButton.addEventListener("click", () => startOAuth("google"));
els.facebookLoginButton.addEventListener("click", () => startOAuth("facebook"));
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

  if (!card) {
    return;
  }

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

initialize().catch((err) => {
  setStatus(err.message);
});
