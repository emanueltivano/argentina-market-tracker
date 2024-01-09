import { MongoClient } from "mongodb";

const connectionString = process.env.ATLAS_URL || "";
const client = new MongoClient(connectionString);

try {
  console.log("Connected to MongoDB Atlas.");
  await client.connect();
} catch (error) {
  console.error("Error connecting to MongoDB Atlas:", error);
  throw error;
}

const db = client.db(process.env.DATABASE);
export default db;