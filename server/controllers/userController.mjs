import bcrypt from "bcrypt";
import db from "../db/connection.mjs";

const UserController = {
  // Login operation
  async login(req, res) {
    const { email, password } = req.body;

    try {
      const user = await db.collection("users").findOne({ email });

      if (!user) {
        return res.status(404).send("User not found");
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).send("Invalid password");
      }

      res.status(200).send("Login successful");
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).send("Internal Server Error during login");
    }
  },

  // Register operation
  async register(req, res) {
    const { username, email, password } = req.body;

    try {
      // Check if the username is already taken
      const existingUsername = await db.collection("users").findOne({ username });
      if (existingUsername) {
        return res.status(400).send("Username already taken");
      }

      // Check if the email is already taken
      const existingEmail = await db.collection("users").findOne({ email });
      if (existingEmail) {
        return res.status(400).send("Email already taken");
      }

      // Hash the password before saving it to the database
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a new user
      const newUser = {
        username,
        email,
        password: hashedPassword,
      };

      // Save the user to the database
      await db.collection("users").insertOne(newUser);

      res.status(201).send("Registration successful");
    } catch (error) {
      console.error("Error during registration:", error);
      res.status(500).send("Internal Server Error during registration");
    }
  },
};

export default UserController;