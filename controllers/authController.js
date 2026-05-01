const User = require("../model/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const handleLogin = async (req, res) => {
  const { id, pwd } = req.body;

  console.log("🔐 Login attempt for ID:", id);

  if (!id || !pwd) {
    return res
      .status(400)
      .json({ message: "User ID and password are required." });
  }

  try {
    // Find user in MongoDB
    const foundUser = await User.findOne({ id: id }).exec();
    if (!foundUser) {
      console.log("❌ User not found in MongoDB:", id);
      return res.sendStatus(401); // Unauthorized
    }

    console.log("✅ User found in MongoDB:", foundUser.id);
    console.log("🔍 User roles:", foundUser.roles);

    // Compare password
    const match = await bcrypt.compare(pwd, foundUser.password);
    if (match) {
      console.log("✅ Password matched for user:", foundUser.id);

      const roles = Object.values(foundUser.roles).filter(Boolean);
      console.log("🎭 User roles for token:", roles);

      // Create access token
      const accessToken = jwt.sign(
        {
          UserInfo: {
            id: foundUser.id,
            roles: roles,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "50m" }
      );

      // Create refresh token
      const refreshToken = jwt.sign(
        { id: foundUser.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "7d" }
      );

      console.log("🔄 Generated refresh token");

      // Save refresh token to MongoDB
      foundUser.refreshToken = refreshToken;
      await foundUser.save();
      console.log("✅ Refresh token saved to MongoDB");

      // Set cookie with refresh token
      res.cookie("jwt", refreshToken, {
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
      });

      // Determine user role
      let userRole = "student";
      if (foundUser.roles.Librarian === 5150) {
        userRole = "librarian";
      } else if (foundUser.roles.Admin) {
        userRole = "admin";
      }

      console.log("🎯 Login successful, sending response for role:", userRole);
      res.json({
        accessToken,
        role: userRole,
        user: {
          id: foundUser.id,
          name: foundUser.name,
          email: foundUser.email,
        },
      });
    } else {
      console.log("❌ Password mismatch for user:", foundUser.id);
      res.sendStatus(401); // Unauthorized
    }
  } catch (error) {
    console.error("❌ Error during login:", error);
    res.status(500).json({ message: "Internal server error during login" });
  }
};

module.exports = { handleLogin };
