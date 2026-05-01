const User = require("../model/User");
const jwt = require("jsonwebtoken");

const handleRefreshToken = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(401);

  const refreshToken = cookies.jwt;
  console.log("🔄 Refresh token attempt");

  try {
    // Find user by refresh token in MongoDB
    const foundUser = await User.findOne({ refreshToken: refreshToken }).exec();
    if (!foundUser) {
      console.log("❌ User not found with refresh token");
      return res.sendStatus(403); // Forbidden
    }

    // Evaluate JWT
    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err || foundUser.id !== decoded.id) {
          console.log("❌ Refresh token verification failed");
          return res.sendStatus(403);
        }

        const roles = Object.values(foundUser.roles).filter(Boolean);
        const accessToken = jwt.sign(
          {
            UserInfo: {
              id: decoded.id,
              roles: roles,
            },
          },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "50m" }
        );

        console.log("✅ New access token generated for:", foundUser.id);
        res.json({ accessToken, roles });
      }
    );
  } catch (error) {
    console.error("❌ Error in refresh token:", error);
    res.sendStatus(500);
  }
};

module.exports = { handleRefreshToken };
