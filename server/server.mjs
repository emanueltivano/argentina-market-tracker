import express from "express";
import cors from "cors";
import 'dotenv/config';
import session from "express-session";
import sessionConfig from "./config/sessionConfig.mjs";
import routes from "./routes/apiRoutes.mjs";

const PORT = process.env.PORT;
const app = express();

app.use(session(sessionConfig));
app.use(cors());
app.use(express.json());

app.use("/api", routes);

// start the Express server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}.`);
});