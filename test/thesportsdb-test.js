// Test script for TheSportsDB API
const axios = require('axios');

// Free API key
const API_KEY = '123';
const BASE_URL_V1 = 'https://www.thesportsdb.com/api/v1/json';

async function testSportsDB() {
  console.log('🧪 Testing TheSportsDB API...\n');

  try {
    // Test 1: Search for a team
    console.log('1️⃣ Testing: Search Teams (Arsenal)');
    const teamResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/searchteams.php?t=Arsenal`);
    console.log('✅ Success!');
    console.log(`   Found ${teamResponse.data.teams?.length || 0} teams`);
    if (teamResponse.data.teams && teamResponse.data.teams.length > 0) {
      console.log(`   First team: ${teamResponse.data.teams[0].strTeam}`);
      console.log(`   Team ID: ${teamResponse.data.teams[0].idTeam}`);
    }
    console.log('');

    // Test 2: Lookup League (Premier League ID: 4328)
    console.log('2️⃣ Testing: Lookup League (Premier League)');
    const leagueResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/lookupleague.php?id=4328`);
    console.log('✅ Success!');
    if (leagueResponse.data.leagues && leagueResponse.data.leagues.length > 0) {
      const league = leagueResponse.data.leagues[0];
      console.log(`   League: ${league.strLeague}`);
      console.log(`   Sport: ${league.strSport}`);
      console.log(`   Country: ${league.strCountry}`);
    }
    console.log('');

    // Test 3: Search Events (Arsenal vs Chelsea)
    console.log('3️⃣ Testing: Search Events (Arsenal vs Chelsea)');
    const eventResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/searchevents.php?e=Arsenal_vs_Chelsea`);
    console.log('✅ Success!');
    console.log(`   Found ${eventResponse.data.event?.length || 0} events`);
    if (eventResponse.data.event && eventResponse.data.event.length > 0) {
      const event = eventResponse.data.event[0];
      console.log(`   Event: ${event.strEvent}`);
      console.log(`   Date: ${event.dateEvent}`);
      console.log(`   Result: ${event.strResult || 'N/A'}`);
    }
    console.log('');

    // Test 3b: Get Recent Arsenal Events (Last 30 days)
    console.log('3️⃣b Testing: Recent Arsenal Events (Last 30 days)');
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // Try to get events from recent dates
    const recentDates = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      recentDates.push(date.toISOString().split('T')[0]); // YYYY-MM-DD
    }
    
    let foundRecentMatch = false;
    for (const date of recentDates.slice(0, 10)) { // Check last 10 days
      try {
        const dayEventsResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/eventsday.php?d=${date}`);
        if (dayEventsResponse.data.events && dayEventsResponse.data.events.length > 0) {
          // Find Arsenal events
          const arsenalEvents = dayEventsResponse.data.events.filter(e => 
            e.strEvent && (
              e.strEvent.toLowerCase().includes('arsenal') ||
              e.strHomeTeam?.toLowerCase().includes('arsenal') ||
              e.strAwayTeam?.toLowerCase().includes('arsenal')
            )
          );
          
          if (arsenalEvents.length > 0) {
            const match = arsenalEvents[0];
            console.log(`   ✅ Found recent Arsenal match on ${date}:`);
            console.log(`   Event: ${match.strEvent || match.strHomeTeam + ' vs ' + match.strAwayTeam}`);
            console.log(`   Date: ${match.dateEvent || date}`);
            console.log(`   Home: ${match.strHomeTeam || 'N/A'}`);
            console.log(`   Away: ${match.strAwayTeam || 'N/A'}`);
            console.log(`   Score: ${match.intHomeScore || 'N/A'} - ${match.intAwayScore || 'N/A'}`);
            console.log(`   Result: ${match.strResult || match.strThumb || 'N/A'}`);
            
            // If we have an event ID, get detailed results
            if (match.idEvent) {
              try {
                const detailedResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/eventresults.php?id=${match.idEvent}`);
                if (detailedResponse.data.results) {
                  console.log(`   📊 Detailed Results Available`);
                }
              } catch (e) {
                // Ignore if detailed results not available
              }
            }
            
            foundRecentMatch = true;
            break;
          }
        }
      } catch (e) {
        // Continue to next date
      }
    }
    
    if (!foundRecentMatch) {
      console.log('   ⚠️  No recent Arsenal matches found in last 10 days');
      console.log('   💡 Trying alternative: Search all Arsenal events...');
      
      // Alternative: Search for Arsenal team events
      try {
        const arsenalTeamId = 133604; // Arsenal team ID from test 1
        const teamEventsResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/eventslast.php?id=${arsenalTeamId}`);
        if (teamEventsResponse.data.results && teamEventsResponse.data.results.length > 0) {
          const recentEvent = teamEventsResponse.data.results[0];
          console.log(`   ✅ Found recent Arsenal event:`);
          console.log(`   Event: ${recentEvent.strEvent || recentEvent.strHomeTeam + ' vs ' + recentEvent.strAwayTeam}`);
          console.log(`   Date: ${recentEvent.dateEvent || 'N/A'}`);
          console.log(`   Score: ${recentEvent.intHomeScore || 'N/A'} - ${recentEvent.intAwayScore || 'N/A'}`);
        }
      } catch (e) {
        console.log('   ⚠️  Could not fetch team events');
      }
    }
    console.log('');

    // Test 4: List All Sports
    console.log('4️⃣ Testing: List All Sports');
    const sportsResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/all_sports.php`);
    console.log('✅ Success!');
    console.log(`   Total sports: ${sportsResponse.data.sports?.length || 0}`);
    if (sportsResponse.data.sports && sportsResponse.data.sports.length > 0) {
      console.log(`   First 5 sports:`);
      sportsResponse.data.sports.slice(0, 5).forEach(sport => {
        console.log(`     - ${sport.strSport}`);
      });
    }
    console.log('');

    // Test 5: Lookup Team (Arsenal Team ID: 133602)
    console.log('5️⃣ Testing: Lookup Team (Arsenal)');
    const teamLookupResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/lookupteam.php?id=133602`);
    console.log('✅ Success!');
    if (teamLookupResponse.data.teams && teamLookupResponse.data.teams.length > 0) {
      const team = teamLookupResponse.data.teams[0];
      console.log(`   Team: ${team.strTeam}`);
      console.log(`   League: ${team.strLeague}`);
      console.log(`   Stadium: ${team.strStadium}`);
    }
    console.log('');

    // Test 6: Get Arsenal's Last Events (Recent Matches)
    console.log('6️⃣ Testing: Arsenal Last Events (Recent Matches)');
    const arsenalTeamId = 133604; // Arsenal team ID from test 1
    try {
      const lastEventsResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/eventslast.php?id=${arsenalTeamId}`);
      console.log('✅ Success!');
      if (lastEventsResponse.data.results && lastEventsResponse.data.results.length > 0) {
        console.log(`   Found ${lastEventsResponse.data.results.length} recent events`);
        const recentMatch = lastEventsResponse.data.results[0];
        console.log(`   📅 Most Recent Match:`);
        console.log(`   Event: ${recentMatch.strEvent || recentMatch.strHomeTeam + ' vs ' + recentMatch.strAwayTeam}`);
        console.log(`   Date: ${recentMatch.dateEvent || 'N/A'}`);
        console.log(`   Home Team: ${recentMatch.strHomeTeam || 'N/A'}`);
        console.log(`   Away Team: ${recentMatch.strAwayTeam || 'N/A'}`);
        console.log(`   Home Score: ${recentMatch.intHomeScore !== null ? recentMatch.intHomeScore : 'N/A'}`);
        console.log(`   Away Score: ${recentMatch.intAwayScore !== null ? recentMatch.intAwayScore : 'N/A'}`);
        console.log(`   Result: ${recentMatch.strResult || recentMatch.strThumb || 'N/A'}`);
        
        // Try to get detailed results if event ID exists
        if (recentMatch.idEvent) {
          try {
            const detailedResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/eventresults.php?id=${recentMatch.idEvent}`);
            if (detailedResponse.data && Object.keys(detailedResponse.data).length > 0) {
              console.log(`   📊 Detailed results available for event ID: ${recentMatch.idEvent}`);
            }
          } catch (e) {
            // Detailed results might not be available
          }
        }
      } else {
        console.log('   ⚠️  No recent events found');
      }
    } catch (error) {
      console.log(`   ⚠️  Error fetching last events: ${error.message}`);
      // Try alternative endpoint
      try {
        console.log('   💡 Trying alternative: eventsnext.php...');
        const nextEventsResponse = await axios.get(`${BASE_URL_V1}/${API_KEY}/eventsnext.php?id=${arsenalTeamId}`);
        if (nextEventsResponse.data.results && nextEventsResponse.data.results.length > 0) {
          console.log(`   Found ${nextEventsResponse.data.results.length} upcoming events`);
        }
      } catch (e) {
        console.log('   ⚠️  Alternative also failed');
      }
    }
    console.log('');

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Run tests
testSportsDB();
