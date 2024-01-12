import express from "express";
import UserController from "../controllers/userController.mjs";
import ApiDataController from "../controllers/apiDataController.mjs";

const router = express.Router();

// Login route
router.post("/login", UserController.login);

// Register route
router.post("/register", UserController.register);

// Panel lider route
router.get("/cotizaciones/panel-lider", ApiDataController.panelLiderData);

export default router;