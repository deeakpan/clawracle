// Test script for OpenWeather API
const axios = require('axios');
require('dotenv').config();

// Get API key from env (required for OpenWeather)
const API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_BASE_URL = 'https://api.openweathermap.org/geo/1.0';

if (!API_KEY) {
  console.error('❌ OPENWEATHER_API_KEY not found in .env');
  console.error('   Get a free API key at: https://home.openweathermap.org/users/sign_up');
  process.exit(1);
}

async function testOpenWeatherAPI() {
  console.log('🧪 Testing OpenWeather API...\n');

  try {
    // Test 1: Geocoding - Get coordinates by city name
    console.log('1️⃣ Testing: Geocoding API (City: "London")');
    const geocodeResponse = await axios.get(`${GEO_BASE_URL}/direct`, {
      params: {
        q: 'London',
        limit: 5,
        appid: API_KEY
      }
    });
    
    console.log('✅ Success!');
    if (geocodeResponse.data && geocodeResponse.data.length > 0) {
      const location = geocodeResponse.data[0];
      console.log(`   Found: ${location.name}, ${location.country}`);
      console.log(`   Coordinates: lat=${location.lat}, lon=${location.lon}`);
      if (location.state) {
        console.log(`   State: ${location.state}`);
      }
      
      // Use these coordinates for next test
      const lat = location.lat;
      const lon = location.lon;
      
      // Test 2: Current weather by coordinates
      console.log('\n2️⃣ Testing: Current Weather (by coordinates)');
      const weatherResponse = await axios.get(`${WEATHER_BASE_URL}/weather`, {
        params: {
          lat: lat,
          lon: lon,
          appid: API_KEY,
          units: 'metric' // Use metric units (Celsius)
        }
      });
      
      console.log('✅ Success!');
      const weather = weatherResponse.data;
      console.log(`   Location: ${weather.name}, ${weather.sys.country}`);
      console.log(`   Temperature: ${weather.main.temp}°C (feels like ${weather.main.feels_like}°C)`);
      console.log(`   Condition: ${weather.weather[0].main} - ${weather.weather[0].description}`);
      console.log(`   Humidity: ${weather.main.humidity}%`);
      console.log(`   Pressure: ${weather.main.pressure} hPa`);
      if (weather.wind) {
        console.log(`   Wind: ${weather.wind.speed} m/s`);
        if (weather.wind.deg) {
          console.log(`   Wind Direction: ${weather.wind.deg}°`);
        }
      }
      if (weather.visibility) {
        console.log(`   Visibility: ${weather.visibility / 1000} km`);
      }
      console.log(`   Updated: ${new Date(weather.dt * 1000).toLocaleString()}`);
    }
    console.log('');

    // Test 3: Current weather for New York
    console.log('3️⃣ Testing: Current Weather for New York');
    const nyWeatherResponse = await axios.get(`${WEATHER_BASE_URL}/weather`, {
      params: {
        q: 'New York,US',
        appid: API_KEY,
        units: 'metric'
      }
    });
    
    console.log('✅ Success!');
    const nyWeather = nyWeatherResponse.data;
    console.log(`   Location: ${nyWeather.name}, ${nyWeather.sys.country}`);
    console.log(`   Current Temperature: ${nyWeather.main.temp}°C (feels like ${nyWeather.main.feels_like}°C)`);
    console.log(`   Condition: ${nyWeather.weather[0].main} - ${nyWeather.weather[0].description}`);
    console.log(`   Humidity: ${nyWeather.main.humidity}%`);
    console.log(`   Pressure: ${nyWeather.main.pressure} hPa`);
    if (nyWeather.wind) {
      console.log(`   Wind: ${nyWeather.wind.speed} m/s`);
    }
    console.log(`   Min/Max: ${nyWeather.main.temp_min}°C / ${nyWeather.main.temp_max}°C`);
    console.log(`   Updated: ${new Date(nyWeather.dt * 1000).toLocaleString()}`);
    console.log('');

    // Test 4: Current weather with imperial units
    console.log('4️⃣ Testing: Current Weather (Imperial units: "Los Angeles")');
    const laWeatherResponse = await axios.get(`${WEATHER_BASE_URL}/weather`, {
      params: {
        q: 'Los Angeles,US',
        appid: API_KEY,
        units: 'imperial' // Fahrenheit
      }
    });
    
    console.log('✅ Success!');
    const laWeather = laWeatherResponse.data;
    console.log(`   Location: ${laWeather.name}, ${laWeather.sys.country}`);
    console.log(`   Temperature: ${laWeather.main.temp}°F`);
    console.log(`   Condition: ${laWeather.weather[0].description}`);
    if (laWeather.wind) {
      console.log(`   Wind: ${laWeather.wind.speed} mph`);
    }
    console.log('');

    // Test 5: Geocoding by zip code
    console.log('5️⃣ Testing: Geocoding API (ZIP: "90210,US")');
    const zipGeocodeResponse = await axios.get(`${GEO_BASE_URL}/zip`, {
      params: {
        zip: '90210,US',
        appid: API_KEY
      }
    });
    
    console.log('✅ Success!');
    const zipLocation = zipGeocodeResponse.data;
    console.log(`   ZIP: ${zipLocation.zip}`);
    console.log(`   Location: ${zipLocation.name}, ${zipLocation.country}`);
    console.log(`   Coordinates: lat=${zipLocation.lat}, lon=${zipLocation.lon}`);
    console.log('');

    // Test 6: Reverse geocoding (coordinates to location name)
    console.log('6️⃣ Testing: Reverse Geocoding (Coordinates: lat=40.7128, lon=-74.0060)');
    const reverseGeocodeResponse = await axios.get(`${GEO_BASE_URL}/reverse`, {
      params: {
        lat: 40.7128,
        lon: -74.0060,
        limit: 5,
        appid: API_KEY
      }
    });
    
    console.log('✅ Success!');
    if (reverseGeocodeResponse.data && reverseGeocodeResponse.data.length > 0) {
      const revLocation = reverseGeocodeResponse.data[0];
      console.log(`   Found: ${revLocation.name}, ${revLocation.country}`);
      if (revLocation.state) {
        console.log(`   State: ${revLocation.state}`);
      }
    }
    console.log('');

    // Test 7: Weather with language parameter
    console.log('7️⃣ Testing: Current Weather (Spanish language: "Madrid")');
    const madridWeatherResponse = await axios.get(`${WEATHER_BASE_URL}/weather`, {
      params: {
        q: 'Madrid,ES',
        appid: API_KEY,
        units: 'metric',
        lang: 'es' // Spanish
      }
    });
    
    console.log('✅ Success!');
    const madridWeather = madridWeatherResponse.data;
    console.log(`   Location: ${madridWeather.name}, ${madridWeather.sys.country}`);
    console.log(`   Temperature: ${madridWeather.main.temp}°C`);
    console.log(`   Condition (Spanish): ${madridWeather.weather[0].description}`);
    console.log('');

    // Test 8: Try to get weather for specific date (February 11, 2026)
    console.log('8️⃣ Testing: Weather for specific date (London, February 11, 2026)');
    try {
      // First get coordinates for London
      const londonGeo = await axios.get(`${GEO_BASE_URL}/direct`, {
        params: {
          q: 'London,GB',
          limit: 1,
          appid: API_KEY
        }
      });
      
      if (londonGeo.data && londonGeo.data.length > 0) {
        const londonLat = londonGeo.data[0].lat;
        const londonLon = londonGeo.data[0].lon;
        
        // Try One Call API 3.0 for historical data (if available)
        // Date: February 11, 2026 = Unix timestamp: 1707609600 (approximate)
        const targetDate = Math.floor(new Date('2026-02-11T12:00:00Z').getTime() / 1000);
        console.log(`   Target date: February 11, 2026 (Unix: ${targetDate})`);
        console.log(`   Coordinates: lat=${londonLat}, lon=${londonLon}`);
        
        // Try One Call API 3.0 historical endpoint
        try {
          const historicalResponse = await axios.get(`https://api.openweathermap.org/data/3.0/onecall/timemachine`, {
            params: {
              lat: londonLat,
              lon: londonLon,
              dt: targetDate,
              appid: API_KEY,
              units: 'metric'
            }
          });
          
          console.log('✅ Success with One Call API 3.0!');
          console.log(`   Historical weather data retrieved`);
          if (historicalResponse.data && historicalResponse.data.data) {
            const weatherData = historicalResponse.data.data[0];
            console.log(`   Temperature: ${weatherData.temp}°C`);
            console.log(`   Condition: ${weatherData.weather[0].description}`);
          }
        } catch (oneCallError) {
          console.log(`   ⚠️  One Call API 3.0 failed: ${oneCallError.response?.status || oneCallError.message}`);
          console.log(`   Trying current weather API (will return current, not historical)...`);
          
          // Fallback to current weather
          const currentResponse = await axios.get(`${WEATHER_BASE_URL}/weather`, {
            params: {
              lat: londonLat,
              lon: londonLon,
              appid: API_KEY,
              units: 'metric'
            }
          });
          
          console.log('   ⚠️  Got current weather instead (no historical endpoint available)');
          console.log(`   Temperature: ${currentResponse.data.main.temp}°C`);
          console.log(`   Condition: ${currentResponse.data.weather[0].description}`);
          console.log(`   Note: This is CURRENT weather, not historical for Feb 11, 2026`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.status || error.message}`);
      if (error.response?.data) {
        console.log(`   Response: ${JSON.stringify(error.response.data)}`);
      }
    }
    console.log('');

    console.log('✅ All tests completed successfully!');
    console.log('\n💡 OpenWeather API Usage Tips:');
    console.log('   - Use Geocoding API to convert city names to coordinates');
    console.log('   - Current weather API accepts lat/lon (recommended), city name, city ID, or zip');
    console.log('   - Units: "standard" (Kelvin), "metric" (Celsius), "imperial" (Fahrenheit)');
    console.log('   - Use "lang" parameter for localized descriptions');
    console.log('   - Historical weather may require One Call API 3.0 (paid subscription)');
    console.log('   - Free tier: 60 calls/minute, 1,000,000 calls/month');
    console.log('   - Note: Built-in geocoding (city name in weather API) is deprecated but still works');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('   Invalid API key. Check OPENWEATHER_API_KEY in .env');
    } else if (error.response?.status === 429) {
      console.error('   Rate limit exceeded. Free tier: 60 calls/minute');
    } else if (error.response?.status === 404) {
      console.error('   Location not found. Check city name or coordinates.');
    }
  }
}

testOpenWeatherAPI();
