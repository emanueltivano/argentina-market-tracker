import express from "express";
import UserController from "../controllers/userController.mjs";

const router = express.Router();

// Login route
router.post("/login", UserController.login);

// Register route
router.post("/register", UserController.register);

export default router;