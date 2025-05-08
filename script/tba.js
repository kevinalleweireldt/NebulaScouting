const BASE_URL = "https://www.thebluealliance.com/api/v3";
const headers = {
  "X-TBA-Auth-Key": process.env.TBA_API_KEY,
  "Content-Type": "application/json",
};
@param {string} emdpoint
@returns {Promise<any>}