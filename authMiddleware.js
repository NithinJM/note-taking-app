const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const authHeader = req.header("Authorization") || "";
  const [scheme, credentials] = authHeader.split(" ");
  const token = scheme?.toLowerCase() === "bearer"
    ? credentials
    : authHeader;

  if (!token) {
    return res.status(401).json({
      message: "Authentication required"
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "Authentication is not configured"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      message: "Invalid token"
    });
  }
};
