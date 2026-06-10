const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const requireAuth = require("./authMiddleware");

const router = express.Router();
const dataDirectory = path.join(__dirname, "data");
const dataFile = path.join(dataDirectory, "notes.json");

const starterNotes = [
  {
    title: "Project ideas",
    content: "Build a note taking app with search, pinning, and a clean Express API.",
    category: "School",
    tags: ["assignment", "express"],
    isPinned: true,
    isArchived: false
  },
  {
    title: "Grocery list",
    content: "Coffee, apples, rice, and notebook paper.",
    category: "Personal",
    tags: ["errands"],
    isPinned: false,
    isArchived: false
  }
];

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function now() {
  return new Date().toISOString();
}

async function ensureDataFile() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch (err) {
    const timestamp = now();
    const notes = starterNotes.map((note) => ({
      id: crypto.randomUUID(),
      ...note,
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    await fs.writeFile(dataFile, JSON.stringify(notes, null, 2));
  }
}

async function readNotes() {
  await ensureDataFile();
  const data = await fs.readFile(dataFile, "utf8");

  try {
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function writeNotes(notes) {
  await fs.writeFile(dataFile, JSON.stringify(notes, null, 2));
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .flatMap((tag) => String(tag).split(","))
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function toNotePayload(body, existing = {}) {
  return {
    title: String(body.title || existing.title || "Untitled note").trim() || "Untitled note",
    content: String(body.content ?? existing.content ?? ""),
    category: String(body.category || existing.category || "General").trim() || "General",
    tags: normalizeTags(body.tags ?? existing.tags),
    isPinned: Boolean(body.isPinned ?? existing.isPinned),
    isArchived: Boolean(body.isArchived ?? existing.isArchived)
  };
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    const pinned = Number(b.isPinned) - Number(a.isPinned);

    if (pinned !== 0) {
      return pinned;
    }

    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

router.use(requireAuth);

router.get("/", asyncRoute(async (req, res) => {
  const notes = await readNotes();

  res.json(sortNotes(notes));
}));

router.post("/", asyncRoute(async (req, res) => {
  const timestamp = now();
  const note = {
    id: crypto.randomUUID(),
    ...toNotePayload(req.body),
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const notes = await readNotes();

  notes.push(note);
  await writeNotes(sortNotes(notes));

  res.status(201).json(note);
}));

router.put("/:id", asyncRoute(async (req, res) => {
  const notes = await readNotes();
  const noteIndex = notes.findIndex((note) => note.id === req.params.id);

  if (noteIndex === -1) {
    return res.status(404).json({ message: "Note not found" });
  }

  const updatedNote = {
    ...notes[noteIndex],
    ...toNotePayload(req.body, notes[noteIndex]),
    updatedAt: now()
  };

  notes[noteIndex] = updatedNote;
  await writeNotes(sortNotes(notes));

  res.json(updatedNote);
}));

router.delete("/:id", asyncRoute(async (req, res) => {
  const notes = await readNotes();
  const nextNotes = notes.filter((note) => note.id !== req.params.id);

  if (nextNotes.length === notes.length) {
    return res.status(404).json({ message: "Note not found" });
  }

  await writeNotes(nextNotes);

  res.json({ message: "Note deleted" });
}));

module.exports = router;
