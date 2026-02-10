#!/usr/bin/env node

const readline = require('readline');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const conversationHistory = [];

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function chat() {
  console.log('🤖 OpenAI Chat Agent');
  console.log('Type "exit" or "quit" to end the conversation\n');

  while (true) {
    const userMessage = await askQuestion('You: ');

    if (userMessage.toLowerCase() === 'exit' || userMessage.toLowerCase() === 'quit') {
      console.log('\n👋 Goodbye!');
      rl.close();
      break;
    }

    if (!userMessage.trim()) {
      continue;
    }

    try {
      process.stdout.write('Agent: ');
      
      conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      const stream = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: conversationHistory,
        stream: true,
      });

      let assistantMessage = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          process.stdout.write(content);
          assistantMessage += content;
        }
      }
      console.log('\n');

      conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      if (error.message.includes('API key')) {
        console.error('Please set your OPENAI_API_KEY in a .env file');
      }
    }
  }
}

// Check if API key is set
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY not found in environment variables');
  console.error('Please create a .env file with: OPENAI_API_KEY=your_api_key_here');
  process.exit(1);
}

chat().catch(console.error);
