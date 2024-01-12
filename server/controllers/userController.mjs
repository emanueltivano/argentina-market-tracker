import bcrypt from "bcrypt";
import db from "../db/connection.mjs";

const UserController = {
  // Login operation
  async login(req, res) {
    const { email, password } = req.body;

    try {
      const user = await db.collection("users").findOne({ email }); // Retrieve user information based on provided email

      if (!user) {
        return res.status(404).send("User not found");
      }

      const isValidPassword = await bcrypt.compare(password, user.password); // Compare hashed password with provided password

      if (!isValidPassword) {
        return res.status(401).send("Invalid password"); // Respond with 401 if password is invalid
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
      const existingUsername = await db.collection("users").findOne({ username }); // Check if the username is already taken
      if (existingUsername) {
        return res.status(400).send("Username already taken");
      }

      const existingEmail = await db.collection("users").findOne({ email }); // Check if the email is already registered
      if (existingEmail) {
        return res.status(400).send("Email already taken");
      }

      const hashedPassword = await bcrypt.hash(password, 10); // Hash the password before saving it to the database

      // Create a new user
      const newUser = {
        username,
        email,
        password: hashedPassword,
      };

      await db.collection("users").insertOne(newUser); // Save the new user to the database

      res.status(201).send("Registration successful");
    } catch (error) {
      console.error("Error during registration:", error);
      res.status(500).send("Internal Server Error during registration");
    }
  },
};

export default UserController;