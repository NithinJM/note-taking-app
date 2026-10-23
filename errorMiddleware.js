function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

function getValidationMessages(error) {
  if (error.name === "ValidationError") {
    return Object.values(error.errors).map((item) => item.message);
  }

  if (error.code === 11000) {
    return ["An account with that email already exists"];
  }

  if (error.name === "CastError") {
    return ["Invalid resource id"];
  }

  return null;
}

function errorHandler(err, req, res, next) {
  const validationMessages = getValidationMessages(err);

  if (validationMessages) {
    return res.status(400).json({
      message: validationMessages[0],
      errors: validationMessages
    });
  }

  console.error(err);
  return res.status(err.status || 500).json({
    message: err.message || "Something went wrong"
  });
}

module.exports = {
  errorHandler,
  notFound
};
