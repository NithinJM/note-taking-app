const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title must be 120 characters or fewer"]
    },
    content: {
      type: String,
      default: "",
      maxlength: [10000, "Content must be 10,000 characters or fewer"]
    },
    category: {
      type: String,
      default: "General",
      trim: true,
      maxlength: [60, "Category must be 60 characters or fewer"]
    },
    tags: {
      type: [String],
      default: []
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

noteSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model("Note", noteSchema);
