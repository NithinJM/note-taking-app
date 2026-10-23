const express = require("express");

const {
  createNote,
  deleteNote,
  getNote,
  getNotes,
  updateNote
} = require("../controllers/noteController");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", getNotes);
router.post("/", createNote);
router.get("/:id", getNote);
router.put("/:id", updateNote);
router.delete("/:id", deleteNote);

module.exports = router;
