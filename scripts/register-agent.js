// Script to register agent in AgentRegistry
const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  console.log('🤖 Registering Agent...\n');

  // Use agent's private key from .env
  if (!process.env.CLAWRACLE_AGENT_KEY) {
    console.error('❌ CLAWRACLE_AGENT_KEY not found in .env');
    console.error('Please set CLAWRACLE_AGENT_KEY in your .env file');
    return;
  }

  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz');
  const wallet = new ethers.Wallet(process.env.CLAWRACLE_AGENT_KEY, provider);
  
  console.log('Agent Wallet:', wallet.address);
  
  // Contract addresses
  const agentRegistryAddress = process.env.CLAWRACLE_AGENT_REGISTRY || '0x9c4C0c565FDB9455Ea46705C7e40eD9823B8236f';
  
  // Agent info
  const agentId = process.env.YOUR_ERC8004_AGENT_ID || '12345'; // Default for testing
  const agentName = process.env.YOUR_AGENT_NAME || 'TestAgent';
  const agentEndpoint = process.env.YOUR_AGENT_ENDPOINT || 'https://testagent.com/api';
  
  // AgentRegistry ABI
  const agentRegistryABI = [
    "function registerAgent(uint256 erc8004AgentId, string name, string endpoint) external",
    "function getAgent(address agentAddress) external view returns (tuple(address agentAddress, uint256 erc8004AgentId, string name, string endpoint, uint256 reputationScore, uint256 totalResolutions, uint256 correctResolutions, uint256 totalValidations, bool isActive, uint256 registeredAt))"
  ];
  
  const agentRegistry = new ethers.Contract(agentRegistryAddress, agentRegistryABI, wallet);
  
  // Check if already registered
  try {
    const existingAgent = await agentRegistry.getAgent(wallet.address);
    if (existingAgent.isActive) {
      console.log('ℹ️  Agent already registered:');
      console.log(`   Name: ${existingAgent.name}`);
      console.log(`   Endpoint: ${existingAgent.endpoint}`);
      console.log(`   Reputation: ${existingAgent.reputationScore}`);
      return;
    }
  } catch (e) {
    // Not registered yet, continue
  }
  
  // Check MON balance for gas
  const monBalance = await provider.getBalance(wallet.address);
  console.log(`MON Balance: ${ethers.formatEther(monBalance)} MON`);
  
  if (monBalance < ethers.parseEther('0.01')) {
    console.error('❌ Insufficient MON for gas fees!');
    console.error('Please fund the agent wallet with MON tokens first');
    return;
  }
  
  // Register agent
  console.log(`\n📝 Registering agent...`);
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Name: ${agentName}`);
  console.log(`   Endpoint: ${agentEndpoint}`);
  
  const tx = await agentRegistry.registerAgent(agentId, agentName, agentEndpoint);
  console.log('Transaction hash:', tx.hash);
  
  console.log('⏳ Waiting for confirmation...');
  const receipt = await tx.wait();
  
  console.log('\n✅ Agent registered successfully!');
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  
  // Verify registration
  const agent = await agentRegistry.getAgent(wallet.address);
  console.log('\n📋 Agent Details:');
  console.log(`   Address: ${agent.agentAddress}`);
  console.log(`   Name: ${agent.name}`);
  console.log(`   Endpoint: ${agent.endpoint}`);
  console.log(`   Active: ${agent.isActive}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
