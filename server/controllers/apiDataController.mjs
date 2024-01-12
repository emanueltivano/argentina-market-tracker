import axios from "axios";
import getTokens from "../config/tokenConfig.mjs";

const apiDataController = {
  // Get stocks information
  async panelLiderData(req, res) {
    try {
      // Get the tokens
      const tokenData = await getTokens();

      // Set up the authorization header
      const headers = {
        Authorization: `Bearer ${tokenData.access_token}`,
      };

      // Make a GET request with the authorization header
      const apiResponse = await axios.get(`${process.env.API_URL}${process.env.PANEL_LIDER_ENDPOINT}`, {
        headers,
      });

      const responseData = apiResponse.data;

      res.json(responseData);
    } catch (error) {
      console.error("Error during API request:", error);
      res.status(500).json({ error: "Internal Server Error during API request" });
    }
  },
};

export default apiDataController;