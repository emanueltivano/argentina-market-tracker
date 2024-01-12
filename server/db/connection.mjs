import { MongoClient } from "mongodb";

const connectionString = process.env.ATLAS_URL || "";

const client = new MongoClient(connectionString); // Create a new MongoClient instance

try {
  console.log("Connected to MongoDB Atlas."); // Log successful connection to MongoDB Atlas
  await client.connect(); // Attempt to establish a connection to the MongoDB Atlas cluster
} catch (error) {
  console.error("Error connecting to MongoDB Atlas:", error); // Log and propagate any errors during connection
  throw error;
}

const db = client.db(process.env.DATABASE); // Connect to the database
export default db;