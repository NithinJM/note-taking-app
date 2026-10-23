const jwt = require("jsonwebtoken");

const User = require("../models/User");

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required for authentication");
  }

  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function validateAuthInput({ name, email, password }, isRegister = false) {
  const errors = [];

  if (isRegister && (!name || String(name).trim().length < 2)) {
    errors.push("Name must be at least 2 characters");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    errors.push("Enter a valid email address");
  }

  if (!password || String(password).length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  return errors;
}

function sendAuthResponse(res, status, user) {
  res.status(status).json({
    token: signToken(user),
    user
  });
}

async function register(req, res, next) {
  try {
    const errors = validateAuthInput(req.body, true);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password
    });

    return sendAuthResponse(res, 201, user);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const errors = validateAuthInput(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const user = await User.findOne({ email: String(req.body.email).toLowerCase().trim() }).select("+password");

    if (!user || !(await user.comparePassword(req.body.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return sendAuthResponse(res, 200, user);
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  login,
  me,
  register
};
