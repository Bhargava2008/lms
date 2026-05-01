const User = require("../model/User");
const bcrypt = require("bcrypt");

const handleNewUser = async (req, res) => {
  const { name, email, id, course, department, pwd } = req.body;

  if (!id || !pwd || !name || !email || !course || !department) {
    return res.status(400).json({
      message:
        "All fields are required: Name, Email, ID, Course, Department, and Password.",
    });
  }

  try {
    console.log("🔄 Registering new user:", {
      name,
      email,
      id,
      course,
      department,
    });

    // Check for duplicate IDs in MongoDB
    const duplicate = await User.findOne({ id: id }).exec();
    if (duplicate) {
      console.log("❌ Duplicate user ID found:", id);
      return res
        .status(409)
        .json({ message: "User with this ID already exists" });
    }

    // Check for duplicate email
    const duplicateEmail = await User.findOne({ email: email }).exec();
    if (duplicateEmail) {
      console.log("❌ Duplicate email found:", email);
      return res
        .status(409)
        .json({ message: "User with this email already exists" });
    }

    // Encrypt the password
    const hashedPwd = await bcrypt.hash(pwd, 10);
    console.log("✅ Password hashed");

    // Create and store the new user in MongoDB
    const newUser = await User.create({
      name: name,
      email: email,
      id: id,
      course: course,
      department: department,
      roles: { Student: 2001 },
      password: hashedPwd,
    });

    console.log("✅ New user created in MongoDB:", newUser);
    res.status(201).json({ success: `New user ${name} created!` });
  } catch (err) {
    console.error("❌ Error creating user:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { handleNewUser };
