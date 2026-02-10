// Test script for NewsAPI
const axios = require('axios');
require('dotenv').config();

// Get API key from env (required for NewsAPI)
const API_KEY = process.env.NEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';

if (!API_KEY) {
  console.error('❌ NEWS_API_KEY not found in .env');
  console.error('   Get a free API key at: https://newsapi.org/register');
  process.exit(1);
}

async function testNewsAPI() {
  console.log('🧪 Testing NewsAPI...\n');

  try {
    // Test 1: Get top headlines (politics category)
    console.log('1️⃣ Testing: Top Headlines (Politics Category)');
    const headlinesResponse = await axios.get(`${BASE_URL}/top-headlines`, {
      params: {
        category: 'politics',
        country: 'us',
        apiKey: API_KEY
      }
    });
    
    console.log('✅ Success!');
    console.log(`   Total results: ${headlinesResponse.data.totalResults || 0}`);
    if (headlinesResponse.data.articles && headlinesResponse.data.articles.length > 0) {
      const article = headlinesResponse.data.articles[0];
      console.log(`   First headline: ${article.title}`);
      console.log(`   Source: ${article.source.name}`);
      console.log(`   Published: ${article.publishedAt}`);
      console.log(`   URL: ${article.url}`);
    }
    console.log('');

    // Test 2: Search for specific topic (e.g., "election")
    console.log('2️⃣ Testing: Search Everything (Query: "election")');
    const searchResponse = await axios.get(`${BASE_URL}/everything`, {
      params: {
        q: 'election',
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 5,
        apiKey: API_KEY
      }
    });
    
    console.log('✅ Success!');
    console.log(`   Total results: ${searchResponse.data.totalResults || 0}`);
    if (searchResponse.data.articles && searchResponse.data.articles.length > 0) {
      console.log(`   Found ${searchResponse.data.articles.length} articles`);
      searchResponse.data.articles.slice(0, 3).forEach((article, idx) => {
        console.log(`   ${idx + 1}. ${article.title}`);
        console.log(`      Source: ${article.source.name}`);
        console.log(`      Date: ${article.publishedAt}`);
      });
    }
    console.log('');

    // Test 3: Search for specific politician/event
    console.log('3️⃣ Testing: Search Everything (Query: "Trump")');
    const trumpResponse = await axios.get(`${BASE_URL}/everything`, {
      params: {
        q: 'Trump',
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 3,
        apiKey: API_KEY
      }
    });
    
    console.log('✅ Success!');
    console.log(`   Total results: ${trumpResponse.data.totalResults || 0}`);
    if (trumpResponse.data.articles && trumpResponse.data.articles.length > 0) {
      const article = trumpResponse.data.articles[0];
      console.log(`   Most recent article:`);
      console.log(`   Title: ${article.title}`);
      console.log(`   Description: ${article.description?.substring(0, 100)}...`);
      console.log(`   Source: ${article.source.name}`);
      console.log(`   Published: ${article.publishedAt}`);
    }
    console.log('');

    // Test 4: Get sources (available news sources)
    console.log('4️⃣ Testing: Get Sources (Politics Category)');
    const sourcesResponse = await axios.get(`${BASE_URL}/top-headlines/sources`, {
      params: {
        category: 'politics',
        country: 'us',
        apiKey: API_KEY
      }
    });
    
    console.log('✅ Success!');
    if (sourcesResponse.data.sources && sourcesResponse.data.sources.length > 0) {
      console.log(`   Found ${sourcesResponse.data.sources.length} sources`);
      console.log(`   First 5 sources:`);
      sourcesResponse.data.sources.slice(0, 5).forEach((source, idx) => {
        console.log(`   ${idx + 1}. ${source.name} (${source.id})`);
      });
    }
    console.log('');

    // Test 5: Search with date range (recent articles)
    console.log('5️⃣ Testing: Search Everything (Query: "president", Recent)');
    const recentResponse = await axios.get(`${BASE_URL}/everything`, {
      params: {
        q: 'president',
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 3,
        apiKey: API_KEY
      }
    });
    
    console.log('✅ Success!');
    if (recentResponse.data.articles && recentResponse.data.articles.length > 0) {
      console.log(`   Most recent articles about "president":`);
      recentResponse.data.articles.forEach((article, idx) => {
        console.log(`   ${idx + 1}. ${article.title}`);
        console.log(`      Published: ${new Date(article.publishedAt).toLocaleString()}`);
        console.log(`      Source: ${article.source.name}`);
      });
    }
    console.log('');

    console.log('✅ All tests completed successfully!');
    console.log('\n💡 NewsAPI Usage Tips:');
    console.log('   - Use /top-headlines for breaking news');
    console.log('   - Use /everything for searching all articles');
    console.log('   - Sort by "publishedAt" for most recent first');
    console.log('   - Can filter by country, category, sources, language');
    console.log('   - Free tier: 100 requests/day');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('   Invalid API key. Check NEWS_API_KEY in .env');
    } else if (error.response?.status === 429) {
      console.error('   Rate limit exceeded. Free tier: 100 requests/day');
    }
  }
}

testNewsAPI();
