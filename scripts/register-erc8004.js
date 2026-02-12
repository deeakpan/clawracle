// Script to register agent in ERC-8004 IdentityRegistry on Monad Mainnet
// Usage: node scripts/register-erc8004.js

const { ethers } = require('ethers');
const lighthouse = require("@lighthouse-web3/sdk");
require('dotenv').config();

async function main() {
  console.log('🔐 Registering Agent in ERC-8004 IdentityRegistry...\n');

  // Check for required environment variables
  if (!process.env.CLAWRACLE_AGENT_KEY) {
    console.error('❌ CLAWRACLE_AGENT_KEY not found in .env');
    console.error('   Please set CLAWRACLE_AGENT_KEY in your .env file');
    process.exit(1);
  }

  if (!process.env.LIGHTHOUSE_API_KEY) {
    console.error('❌ LIGHTHOUSE_API_KEY not found in .env');
    console.error('   Please set LIGHTHOUSE_API_KEY for IPFS uploads');
    process.exit(1);
  }

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider('https://rpc.monad.xyz');
  const wallet = new ethers.Wallet(process.env.CLAWRACLE_AGENT_KEY, provider);
  
  console.log('Agent Wallet:', wallet.address);

  // Check MON balance for gas
  const monBalance = await provider.getBalance(wallet.address);
  console.log(`MON Balance: ${ethers.formatEther(monBalance)} MON`);

  if (monBalance < ethers.parseEther('0.01')) {
    console.error('❌ Insufficient MON for gas fees!');
    console.error('   Please fund the agent wallet with MON tokens first');
    process.exit(1);
  }

  // Agent metadata
  const agentName = 'DEE CLAWRACLE AGENT';
  const agentDescription = 'Advanced AI-powered oracle agent for the Clawracle decentralized oracle network on Monad. Specializes in real-time data resolution across multiple categories including sports, weather, market data, and news. Utilizes LLM-driven API integration for dynamic data fetching and validation. Built for high-speed resolution with WebSocket event monitoring and automatic dispute handling. Maintains on-chain reputation through accurate data provision and cross-protocol compatibility via ERC-8004 standard.';
  const agentEndpoint = 'https://deesclawracle.vercel.app/api';
  const agentVersion = '1.0.0';

  // Create metadata object
  const metadata = {
    name: agentName,
    description: agentDescription,
    endpoint: agentEndpoint,
    version: agentVersion,
    capabilities: ['oracle', 'data-resolution', 'validation'],
    network: 'Monad Mainnet',
    registeredAt: new Date().toISOString(),
    wallet: wallet.address
  };

  console.log('\n📝 Agent Metadata:');
  console.log(`   Name: ${metadata.name}`);
  console.log(`   Description: ${metadata.description}`);
  console.log(`   Endpoint: ${metadata.endpoint}`);
  console.log(`   Version: ${metadata.version}`);

  // Upload metadata to Lighthouse IPFS
  console.log('\n📤 Uploading metadata to Lighthouse IPFS...');
  try {
    const uploadResponse = await lighthouse.uploadText(
      JSON.stringify(metadata, null, 2),
      process.env.LIGHTHOUSE_API_KEY
    );
    
    const ipfsCID = uploadResponse.data.Hash;
    const ipfsURI = `ipfs://${ipfsCID}`;
    const ipfsGatewayURL = `https://ipfs.io/ipfs/${ipfsCID}`;
    
    console.log('✅ Metadata uploaded to IPFS');
    console.log(`   CID: ${ipfsCID}`);
    console.log(`   IPFS URI: ${ipfsURI}`);
    console.log(`   Gateway URL: ${ipfsGatewayURL}`);

    // ERC-8004 IdentityRegistry contract address on Monad Mainnet
    const identityRegistryAddress = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

    // ERC-8004 IdentityRegistry ABI (standard register function)
    // Note: ERC-8004 mints ERC721 tokens - the token ID is the agent ID
    const identityRegistryABI = [
      "function register(string calldata metadataURI) external returns (uint256 agentId)",
      "function registerAgent(string calldata name, string calldata metadataURI) external returns (uint256 agentId)",
      "function registerAgentWithMetadata(string calldata metadataURI) external returns (uint256 agentId)",
      "function getAgentId(address agent) external view returns (uint256)",
      "function getAgent(uint256 agentId) external view returns (address agent, string memory metadataURI)",
      "event AgentRegistered(address indexed agent, uint256 indexed agentId, string metadataURI)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
    ];

    const identityRegistry = new ethers.Contract(
      identityRegistryAddress,
      identityRegistryABI,
      wallet
    );

    console.log('\n📝 Registering agent in ERC-8004 IdentityRegistry...');
    console.log(`   Contract: ${identityRegistryAddress}`);

    // Try different registration function signatures
    let tx;
    let agentId = null;

    try {
      // Try registerAgentWithMetadata first (most common pattern)
      console.log('   Attempting registerAgentWithMetadata...');
      tx = await identityRegistry.registerAgentWithMetadata(ipfsURI);
      const receipt = await tx.wait();
      
      // Try to extract agentId from events
      const event = receipt.logs.find(log => {
        try {
          const parsed = identityRegistry.interface.parseLog(log);
          return parsed && parsed.name === 'AgentRegistered';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsed = identityRegistry.interface.parseLog(event);
        agentId = parsed.args.agentId.toString();
      }
    } catch (error1) {
      try {
        // Try registerAgent with name and metadataURI
        console.log('   Attempting registerAgent...');
        tx = await identityRegistry.registerAgent(agentName, ipfsURI);
        const receipt = await tx.wait();
        
        const event = receipt.logs.find(log => {
          try {
            const parsed = identityRegistry.interface.parseLog(log);
            return parsed && parsed.name === 'AgentRegistered';
          } catch {
            return false;
          }
        });
        
        if (event) {
          const parsed = identityRegistry.interface.parseLog(event);
          agentId = parsed.args.agentId.toString();
        }
      } catch (error2) {
        try {
          // Try simple register function
          console.log('   Attempting register...');
          tx = await identityRegistry.register(ipfsURI);
          const receipt = await tx.wait();
          
          const event = receipt.logs.find(log => {
            try {
              const parsed = identityRegistry.interface.parseLog(log);
              return parsed && parsed.name === 'AgentRegistered';
            } catch {
              return false;
            }
          });
          
          if (event) {
            const parsed = identityRegistry.interface.parseLog(event);
            agentId = parsed.args.agentId.toString();
          }
        } catch (error3) {
          console.error('❌ All registration methods failed');
          console.error('   Error 1:', error1.message);
          console.error('   Error 2:', error2.message);
          console.error('   Error 3:', error3.message);
          console.error('\n💡 Please check the ERC-8004 contract ABI and adjust the script accordingly');
          process.exit(1);
        }
      }
    }

    console.log('✅ Registration transaction submitted');
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Try to extract agentId from all events in the receipt
    // ERC-8004 mints ERC721 tokens - look for Transfer event with tokenId
    if (!agentId && receipt.logs) {
      console.log('\n🔍 Parsing transaction events...');
      for (const log of receipt.logs) {
        try {
          // Try parsing with the contract interface
          const parsed = identityRegistry.interface.parseLog(log);
          if (parsed) {
            console.log(`   Found event: ${parsed.name}`);
            
            // ERC721 Transfer event: Transfer(from, to, tokenId)
            // The tokenId is the agentId
            if (parsed.name === 'Transfer') {
              if (parsed.args.tokenId !== undefined) {
                agentId = parsed.args.tokenId.toString();
                console.log(`   ✅ Found agentId from Transfer event: ${agentId}`);
                break;
              }
            }
            
            if (parsed.name === 'AgentRegistered' || parsed.name.includes('Registered')) {
              // Try different argument positions for agentId
              if (parsed.args.agentId !== undefined) {
                agentId = parsed.args.agentId.toString();
                console.log(`   ✅ Found agentId from AgentRegistered event: ${agentId}`);
                break;
              } else if (parsed.args.id !== undefined) {
                agentId = parsed.args.id.toString();
                break;
              } else if (parsed.args[1] !== undefined) {
                agentId = parsed.args[1].toString();
                break;
              }
            }
          }
        } catch (e) {
          // Try raw log parsing for ERC721 Transfer event
          try {
            // Transfer event signature: keccak256("Transfer(address,address,uint256)")
            // topics[0] = event signature
            // topics[1] = from address (indexed)
            // topics[2] = to address (indexed)
            // topics[3] = tokenId (indexed) - THIS IS THE AGENT ID
            if (log.topics && log.topics.length >= 4) {
              // Check if this is a Transfer event (0x0 address to agent address)
              const zeroAddress = '0x0000000000000000000000000000000000000000';
              const fromAddress = log.topics[1].toLowerCase();
              const toAddress = log.topics[2].toLowerCase();
              
              if (fromAddress === zeroAddress && toAddress === wallet.address.toLowerCase()) {
                const tokenId = BigInt(log.topics[3]);
                if (tokenId > 0n) {
                  agentId = tokenId.toString();
                  console.log(`   ✅ Found agentId from ERC721 Transfer event: ${agentId}`);
                  break;
                }
              }
            }
          } catch (e2) {
            // Skip this log
          }
        }
      }
    }

    // If agentId still not found, try to get it from the contract
    if (!agentId) {
      try {
        console.log('\n🔍 Querying contract for agentId...');
        agentId = await identityRegistry.getAgentId(wallet.address);
        agentId = agentId.toString();
        if (agentId === '0') {
          agentId = null;
        }
      } catch (error) {
        console.log('⚠️  Could not retrieve agentId from contract');
      }
    }

    if (agentId) {
      console.log(`\n🎉 Agent registered successfully!`);
      console.log(`   ERC-8004 Agent ID: ${agentId}`);
      console.log(`   Metadata URI: ${ipfsURI}`);
      console.log(`   Gateway URL: ${ipfsGatewayURL}`);
      console.log(`\n📋 Add to your .env file:`);
      console.log(`   YOUR_ERC8004_AGENT_ID=${agentId}`);
    } else {
      console.log(`\n✅ Registration completed`);
      console.log(`   Transaction: ${tx.hash}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Metadata URI: ${ipfsURI}`);
      console.log(`\n⚠️  Could not extract agentId automatically`);
      console.log(`   Please check the transaction on block explorer:`);
      console.log(`   https://monadvision.com/tx/${tx.hash}`);
      console.log(`   Or query the contract directly with your address: ${wallet.address}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Lighthouse')) {
      console.error('\n💡 Lighthouse troubleshooting:');
      console.error('   1. Check LIGHTHOUSE_API_KEY is correct');
      console.error('   2. Verify network connectivity');
      console.error('   3. Check Lighthouse service status');
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
