const express = require("express");
const jwt = require("jsonwebtoken");

const requireAuth = require("./authMiddleware");

const router = express.Router();

const providers = {
  google: {
    label: "Google",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scope: "openid email profile"
  },
  facebook: {
    label: "Facebook",
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    scope: "email,public_profile"
  }
};

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required for authentication");
  }

  return process.env.JWT_SECRET;
}

function getBaseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function getClientUrl(req) {
  return process.env.CLIENT_URL || getBaseUrl(req);
}

function getCallbackUrl(req, providerName) {
  return `${getBaseUrl(req)}/api/auth/${providerName}/callback`;
}

function getFacebookBase(host) {
  const version = process.env.FACEBOOK_GRAPH_VERSION;
  return version ? `https://${host}/${version}` : `https://${host}`;
}

function getProvider(req, res) {
  const provider = providers[req.params.provider];

  if (!provider) {
    res.status(404).json({ message: "Authentication provider not found" });
    return null;
  }

  return provider;
}

function getMissingConfig(provider) {
  return [
    provider.clientIdEnv,
    provider.clientSecretEnv,
    "JWT_SECRET"
  ].filter((key) => !process.env[key]);
}

function ensureProviderConfig(provider, res) {
  const missing = getMissingConfig(provider);

  if (missing.length > 0) {
    res.status(500).json({
      message: `${provider.label} authentication is not configured`,
      missing
    });
    return false;
  }

  return true;
}

function createStateToken(providerName) {
  return jwt.sign(
    {
      provider: providerName,
      type: "oauth_state"
    },
    getJwtSecret(),
    { expiresIn: "10m" }
  );
}

function verifyStateToken(token, providerName) {
  const decoded = jwt.verify(token, getJwtSecret());
  return decoded.type === "oauth_state" && decoded.provider === providerName;
}

function buildClientRedirect(req, values) {
  const url = new URL(getClientUrl(req));
  url.hash = new URLSearchParams(values).toString();
  return url.toString();
}

function redirectWithAuthError(req, res, message) {
  res.redirect(buildClientRedirect(req, { auth_error: message }));
}

async function readJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error_description || data.error?.message || data.error || fallbackMessage);
  }

  return data;
}

async function exchangeGoogleCode(code, redirectUri) {
  const provider = providers.google;
  const response = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env[provider.clientIdEnv],
      client_secret: process.env[provider.clientSecretEnv],
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });

  return readJsonResponse(response, "Google token exchange failed");
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch(providers.google.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const profile = await readJsonResponse(response, "Google profile request failed");

  return {
    providerId: profile.sub,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.picture
  };
}

async function exchangeFacebookCode(code, redirectUri) {
  const provider = providers.facebook;
  const tokenUrl = new URL(`${getFacebookBase("graph.facebook.com")}/oauth/access_token`);
  tokenUrl.search = new URLSearchParams({
    client_id: process.env[provider.clientIdEnv],
    client_secret: process.env[provider.clientSecretEnv],
    code,
    redirect_uri: redirectUri
  }).toString();

  const response = await fetch(tokenUrl);
  return readJsonResponse(response, "Facebook token exchange failed");
}

async function fetchFacebookProfile(accessToken) {
  const userInfoUrl = new URL(`${getFacebookBase("graph.facebook.com")}/me`);
  userInfoUrl.search = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name,email,picture"
  }).toString();

  const response = await fetch(userInfoUrl);
  const profile = await readJsonResponse(response, "Facebook profile request failed");

  return {
    providerId: profile.id,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.picture?.data?.url
  };
}

function createUser(providerName, profile) {
  return {
    id: `${providerName}:${profile.providerId}`,
    provider: providerName,
    providerId: profile.providerId,
    name: profile.name || profile.email || "Signed in user",
    email: profile.email || "",
    avatarUrl: profile.avatarUrl || ""
  };
}

router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      provider: req.user.provider,
      name: req.user.name,
      email: req.user.email,
      avatarUrl: req.user.avatarUrl
    }
  });
});

router.get("/:provider/callback", asyncRoute(async (req, res) => {
  const providerName = req.params.provider;
  const provider = getProvider(req, res);

  if (!provider || !ensureProviderConfig(provider, res)) {
    return;
  }

  if (req.query.error) {
    redirectWithAuthError(req, res, `${provider.label} sign in was canceled`);
    return;
  }

  const { code, state } = req.query;
  let stateIsValid = false;

  try {
    stateIsValid = Boolean(state && verifyStateToken(state, providerName));
  } catch (err) {
    stateIsValid = false;
  }

  if (!code || !stateIsValid) {
    redirectWithAuthError(req, res, "Sign in could not be verified");
    return;
  }

  const redirectUri = getCallbackUrl(req, providerName);
  const tokenData = providerName === "google"
    ? await exchangeGoogleCode(code, redirectUri)
    : await exchangeFacebookCode(code, redirectUri);

  if (!tokenData.access_token) {
    redirectWithAuthError(req, res, `${provider.label} did not return an access token`);
    return;
  }

  const profile = providerName === "google"
    ? await fetchGoogleProfile(tokenData.access_token)
    : await fetchFacebookProfile(tokenData.access_token);
  const user = createUser(providerName, profile);
  const authToken = jwt.sign(user, getJwtSecret(), { expiresIn: "7d" });

  res.redirect(buildClientRedirect(req, {
    auth_token: authToken,
    provider: providerName
  }));
}));

router.get("/:provider", (req, res) => {
  const providerName = req.params.provider;
  const provider = getProvider(req, res);

  if (!provider || !ensureProviderConfig(provider, res)) {
    return;
  }

  const authUrl = new URL(providerName === "google"
    ? provider.authUrl
    : `${getFacebookBase("www.facebook.com")}/dialog/oauth`);

  authUrl.search = new URLSearchParams({
    client_id: process.env[provider.clientIdEnv],
    redirect_uri: getCallbackUrl(req, providerName),
    response_type: "code",
    scope: provider.scope,
    state: createStateToken(providerName)
  }).toString();

  if (providerName === "google") {
    authUrl.searchParams.set("access_type", "online");
    authUrl.searchParams.set("prompt", "select_account");
  }

  res.redirect(authUrl.toString());
});

module.exports = router;
