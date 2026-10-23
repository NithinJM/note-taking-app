const mongoose = require("mongoose");

const Note = require("../models/Note");

function normalizeTags(tags) {
  const values = Array.isArray(tags) ? tags : String(tags || "").split(",");

  return [...new Set(values
    .flatMap((tag) => String(tag).split(","))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10))]
    .map((tag) => tag.slice(0, 30));
}

function validateNoteInput(body, isPartial = false) {
  const errors = [];
  const title = body.title === undefined ? undefined : String(body.title).trim();
  const content = body.content === undefined ? undefined : String(body.content);

  if (!isPartial && !title && !content) {
    errors.push("Add a title or content before saving");
  }

  if (title !== undefined && title.length > 120) {
    errors.push("Title must be 120 characters or fewer");
  }

  if (content !== undefined && content.length > 10000) {
    errors.push("Content must be 10,000 characters or fewer");
  }

  if (body.category !== undefined && String(body.category).trim().length > 60) {
    errors.push("Category must be 60 characters or fewer");
  }

  return errors;
}

function toNotePayload(body, existing = {}) {
  const title = body.title === undefined
    ? existing.title
    : String(body.title).trim();
  const content = body.content === undefined
    ? existing.content
    : String(body.content);

  return {
    title: title || "Untitled note",
    content: content || "",
    category: body.category === undefined
      ? existing.category || "General"
      : String(body.category).trim() || "General",
    tags: body.tags === undefined ? existing.tags || [] : normalizeTags(body.tags),
    isPinned: body.isPinned === undefined ? Boolean(existing.isPinned) : Boolean(body.isPinned),
    isArchived: body.isArchived === undefined ? Boolean(existing.isArchived) : Boolean(body.isArchived)
  };
}

function ensureValidId(id, res) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid note id" });
    return false;
  }

  return true;
}

async function getNotes(req, res, next) {
  try {
    const notes = await Note.find({ user: req.user.id })
      .sort({ isPinned: -1, updatedAt: -1 });

    return res.json(notes);
  } catch (err) {
    return next(err);
  }
}

async function getNote(req, res, next) {
  try {
    if (!ensureValidId(req.params.id, res)) {
      return null;
    }

    const note = await Note.findOne({ _id: req.params.id, user: req.user.id });

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    return res.json(note);
  } catch (err) {
    return next(err);
  }
}

async function createNote(req, res, next) {
  try {
    const errors = validateNoteInput(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const note = await Note.create({
      ...toNotePayload(req.body),
      user: req.user.id
    });

    return res.status(201).json(note);
  } catch (err) {
    return next(err);
  }
}

async function updateNote(req, res, next) {
  try {
    if (!ensureValidId(req.params.id, res)) {
      return null;
    }

    const errors = validateNoteInput(req.body, true);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const note = await Note.findOne({ _id: req.params.id, user: req.user.id });

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    Object.assign(note, toNotePayload(req.body, note));
    await note.save();

    return res.json(note);
  } catch (err) {
    return next(err);
  }
}

async function deleteNote(req, res, next) {
  try {
    if (!ensureValidId(req.params.id, res)) {
      return null;
    }

    const deleted = await Note.findOneAndDelete({ _id: req.params.id, user: req.user.id });

    if (!deleted) {
      return res.status(404).json({ message: "Note not found" });
    }

    return res.json({ message: "Note deleted" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createNote,
  deleteNote,
  getNote,
  getNotes,
  updateNote
};
