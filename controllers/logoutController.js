const User = require("../model/User");

const handleLogout = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); // No content

  const refreshToken = cookies.jwt;

  try {
    // Find user by refresh token in MongoDB
    const foundUser = await User.findOne({ refreshToken: refreshToken }).exec();

    if (foundUser) {
      // Delete refresh token in MongoDB
      foundUser.refreshToken = "";
      await foundUser.save();
      console.log("✅ Refresh token cleared from MongoDB for:", foundUser.id);
    }

    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });

    console.log("✅ Logout successful");
    res.sendStatus(204);
  } catch (error) {
    console.error("❌ Error during logout:", error);
    res.sendStatus(500);
  }
};

module.exports = { handleLogout };
