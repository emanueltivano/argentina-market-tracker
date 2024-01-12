import axios from "axios";

// Function to obtain access tokens
export default async function getTokens() {
    const username = process.env.API_USERNAME;
    const password = process.env.API_PASSWORD;

    try {
        // Request a new access token
        const tokenResponse = await axios.post(`${process.env.API_URL}${process.env.TOKEN_ENDPOINT}`, {
            username,
            password,
            grant_type: "password",
        });

        return tokenResponse.data;
    } catch (error) {
        console.error("Error during token acquisition:", error);
        throw new Error("Internal Server Error during token acquisition");
    }
}