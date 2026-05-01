const verifyRoles = (...allowedRoles) => {
  return (req, res, next) => {
    console.log("👤 Role Verification - User:", req.user);
    console.log("👤 User roles:", req.roles);
    console.log("🔑 Allowed roles:", allowedRoles);

    if (!req?.roles) {
      console.log("❌ No roles found in request");
      return res.sendStatus(401);
    }

    const rolesArray = [...allowedRoles];
    console.log("Allowed roles array:", rolesArray);

    // Handle both array and single role scenarios
    const userRoles = Array.isArray(req.roles) ? req.roles : [req.roles];
    console.log("User roles array:", userRoles);

    // Check if ANY user role matches ANY allowed role
    const hasRole = userRoles.some((role) => rolesArray.includes(role));

    console.log("Role check result:", hasRole);

    if (!hasRole) {
      console.log("❌ Access denied: User does not have required role");
      return res.sendStatus(401);
    }

    console.log("✅ Role verification passed!");
    next();
  };
};

module.exports = verifyRoles;
