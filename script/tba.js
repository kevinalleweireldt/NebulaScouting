const BASE_URL = "https://www.thebluealliance.com/api/v3";

const headers = {
  "X-TBA-Auth-Key": process.env.TBA_API_KEY,
  "Content-Type": "application/json",
};

/**
 * Fetch data from The Blue Alliance API.
 * @param {string} endpoint
 * @returns {Promise<any>}
 */

async function fetchTBAData(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers: headers,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
}
