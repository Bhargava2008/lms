const jwt = require("jsonwebtoken");

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    console.log("❌ No Bearer token found in headers:", authHeader);
    return res.sendStatus(401);
  }

  const token = authHeader.split(" ")[1];

  // Log token expiry for debugging
  try {
    const decodedWithoutVerify = jwt.decode(token);
    if (decodedWithoutVerify) {
      const expiry = new Date(decodedWithoutVerify.exp * 1000);
      console.log(`🔐 Token expires at: ${expiry.toLocaleString()}`);
    }
  } catch (e) {
    // Just for debugging, continue with verification
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log("❌ JWT verification failed:", err.message);
      console.log("❌ Token:", token); // Remove this in production
      return res.sendStatus(403);
    }

    console.log("✅ JWT verified - User:", decoded.UserInfo?.id);
    req.user = decoded.UserInfo?.id;
    req.roles = decoded.UserInfo?.roles;
    next();
  });
};

module.exports = verifyJWT;
