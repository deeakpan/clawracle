// Script to query ERC-8004 Agent ID from IdentityRegistry
// Usage: node scripts/get-erc8004-agentid.js [agentAddress]

const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
  const agentAddress = process.argv[2] || process.env.CLAWRACLE_AGENT_KEY 
    ? new ethers.Wallet(process.env.CLAWRACLE_AGENT_KEY).address 
    : null;

  if (!agentAddress) {
    console.error('❌ Agent address required');
    console.error('Usage: node scripts/get-erc8004-agentid.js <agentAddress>');
    console.error('   Or set CLAWRACLE_AGENT_KEY in .env');
    process.exit(1);
  }

  console.log('🔍 Querying ERC-8004 Agent ID...\n');
  console.log(`Agent Address: ${agentAddress}`);

  const provider = new ethers.JsonRpcProvider('https://rpc.monad.xyz');
  const identityRegistryAddress = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

  // ERC-8004 IdentityRegistry ABI
  // Note: ERC-8004 mints ERC721 tokens - need to check AgentIdentity contract for balance
  const identityRegistryABI = [
    "function getAgentId(address agent) external view returns (uint256)",
    "function getAgent(uint256 agentId) external view returns (address agent, string memory metadataURI)",
    "function getAgentMetadata(address agent) external view returns (string memory)",
    "function agents(address) external view returns (uint256 agentId, string memory metadataURI)"
  ];

  // AgentIdentity ERC721 contract ABI (the token contract)
  const agentIdentityABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
    "function ownerOf(uint256 tokenId) external view returns (address)"
  ];

  const identityRegistry = new ethers.Contract(
    identityRegistryAddress,
    identityRegistryABI,
    provider
  );

  try {
    // First, try checking ERC721 token balance (AgentIdentity contract)
    // The IdentityRegistry contract address is also the AgentIdentity token contract
    try {
      const agentIdentity = new ethers.Contract(
        identityRegistryAddress,
        agentIdentityABI,
        provider
      );
      
      const balance = await agentIdentity.balanceOf(agentAddress);
      if (balance > 0n) {
        // Get the first token ID owned by this address
        const tokenId = await agentIdentity.tokenOfOwnerByIndex(agentAddress, 0);
        console.log(`\n✅ ERC-8004 Agent ID: ${tokenId.toString()}`);
        console.log(`   (Found via ERC721 token balance)`);
        console.log(`\n📋 Add to your .env file:`);
        console.log(`   YOUR_ERC8004_AGENT_ID=${tokenId.toString()}`);
        return;
      }
    } catch (e) {
      console.log('   ERC721 token check not available, trying other methods...');
    }

    // Try getAgentId
    try {
      const agentId = await identityRegistry.getAgentId(agentAddress);
      if (agentId.toString() !== '0') {
        console.log(`\n✅ ERC-8004 Agent ID: ${agentId.toString()}`);
        console.log(`\n📋 Add to your .env file:`);
        console.log(`   YOUR_ERC8004_AGENT_ID=${agentId.toString()}`);
        return;
      }
    } catch (e) {
      console.log('   getAgentId not available, trying other methods...');
    }

    // Try agents mapping
    try {
      const agentData = await identityRegistry.agents(agentAddress);
      if (agentData.agentId && agentData.agentId.toString() !== '0') {
        console.log(`\n✅ ERC-8004 Agent ID: ${agentData.agentId.toString()}`);
        console.log(`   Metadata URI: ${agentData.metadataURI}`);
        console.log(`\n📋 Add to your .env file:`);
        console.log(`   YOUR_ERC8004_AGENT_ID=${agentData.agentId.toString()}`);
        return;
      }
    } catch (e) {
      console.log('   agents mapping not available...');
    }

    // Try getAgentMetadata
    try {
      const metadataURI = await identityRegistry.getAgentMetadata(agentAddress);
      if (metadataURI && metadataURI !== '') {
        console.log(`\n✅ Agent found (metadata URI: ${metadataURI})`);
        console.log(`   However, agentId could not be retrieved directly.`);
        console.log(`   Check the contract events for your registration transaction.`);
        return;
      }
    } catch (e) {
      // Continue
    }

    console.log('\n⚠️  Agent ID not found');
    console.log('   The agent may not be registered yet, or the contract interface differs.');
    console.log('   Check your registration transaction on the block explorer.');

  } catch (error) {
    console.error('❌ Error querying contract:', error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
