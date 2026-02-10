// Script to submit a data request to Clawracle
const { ethers } = require('hardhat');
const lighthouse = require("@lighthouse-web3/sdk");
require('dotenv').config();

async function main() {
  console.log('📤 Submitting Data Request to Clawracle...\n');

  const [requester] = await ethers.getSigners();
  console.log('Requester:', requester.address);

  // Contract addresses
  const registryAddress = process.env.CLAWRACLE_REGISTRY || '0x36F799abBB9C36F2a1a605f51Bd281EfbD63589E';
  const tokenAddress = process.env.CLAWRACLE_TOKEN || '0xF1e9B3B3efdeE7576119426b40C4F85A4Bd59416';

  // Query details
  const query = "Did the White House approve plans for ICE at polling places on February 9, 2026?";
  const category = "politics";
  const reward = ethers.parseEther('500'); // 500 CLAWCLE reward
  const bondRequired = ethers.parseEther('500'); // 500 CLAWCLE bond

  // Time calculations
  const now = Math.floor(Date.now() / 1000);
  const validFrom = now + (3 * 60); // 3 minutes from now
  const deadline = now + (24 * 60 * 60); // 24 hours from now

  console.log('Query:', query);
  console.log('Category:', category);
  console.log('Reward:', ethers.formatEther(reward), 'CLAWCLE');
  console.log('Bond Required:', ethers.formatEther(bondRequired), 'CLAWCLE');
  console.log('Valid From:', new Date(validFrom * 1000).toLocaleString());
  console.log('Deadline:', new Date(deadline * 1000).toLocaleString());

  // Create query data for IPFS
  const queryData = {
    query: query,
    category: category,
    expectedFormat: "SingleEntity",
    validFrom: validFrom,
    deadline: deadline,
    bondRequired: bondRequired.toString(),
    reward: reward.toString(),
    metadata: {
      teams: ["Arsenal", "Sunderland"],
      description: "Premier League match result"
    }
  };

  // Upload to Lighthouse IPFS
  const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!lighthouseApiKey) {
    console.error('❌ LIGHTHOUSE_API_KEY not found in .env');
    console.error('Please set LIGHTHOUSE_API_KEY in your .env file');
    console.error('\n💡 You can get a free API key at: https://lighthouse.storage/');
    return;
  }

  console.log('\n📤 Uploading query to Lighthouse IPFS...');
  let ipfsCID;
  try {
    console.log(`   API key length: ${lighthouseApiKey.length} chars`);
    console.log(`   Uploading to Lighthouse...`);
    
    const uploadResponse = await lighthouse.uploadText(
      JSON.stringify(queryData, null, 2),
      lighthouseApiKey
    );
    
    if (uploadResponse.data && uploadResponse.data.Hash) {
      ipfsCID = uploadResponse.data.Hash;
      const ipfsURI = `ipfs://${ipfsCID}`;
      console.log(`✅ Uploaded to IPFS: ${ipfsCID}`);
      console.log(`   IPFS URI: ${ipfsURI}`);
      console.log(`   Gateway URL: https://ipfs.io/ipfs/${ipfsCID}`);
    } else {
      console.error(`   Response:`, JSON.stringify(uploadResponse, null, 2));
      throw new Error("Invalid Lighthouse response format");
    }
  } catch (error) {
    console.error(`❌ Failed to upload to IPFS`);
    console.error(`   Error: ${error.message}`);
    if (error.cause) {
      console.error(`   Cause: ${error.cause.message || JSON.stringify(error.cause)}`);
    }
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
    }
    
    // Check if it's a network issue
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.error(`\n⚠️  Network error detected. Possible issues:`);
      console.error(`   1. Check your internet connection`);
      console.error(`   2. Verify LIGHTHOUSE_API_KEY is correct`);
      console.error(`   3. Lighthouse service might be down`);
      console.error(`   4. Check firewall/proxy settings`);
    }
    
    return; // Stop execution on error
  }

  // Get token contract for approval
  const tokenABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)"
  ];
  const token = await ethers.getContractAt(tokenABI, tokenAddress, requester);

  // Check balance
  const balance = await token.balanceOf(requester.address);
  console.log(`\nRequester CLAWCLE Balance: ${ethers.formatEther(balance)} CLAWCLE`);

  if (balance < reward) {
    console.error(`❌ Insufficient balance! Need ${ethers.formatEther(reward)} CLAWCLE`);
    return;
  }

  // Approve reward tokens
  console.log(`\n💰 Approving ${ethers.formatEther(reward)} CLAWCLE for registry...`);
  const approveTx = await token.approve(registryAddress, reward);
  await approveTx.wait();
  console.log('✅ Approval confirmed');

  // Get registry contract
  const registryABI = [
    "function submitRequest(string calldata ipfsCID, string calldata category, uint256 validFrom, uint256 deadline, uint8 expectedFormat, uint256 bondRequired, uint256 reward) external returns (uint256 requestId)",
    "event RequestSubmitted(uint256 indexed requestId, address indexed requester, string ipfsCID, string category, uint256 validFrom, uint256 deadline, uint256 reward, uint256 bondRequired)"
  ];
  const registry = await ethers.getContractAt(registryABI, registryAddress, requester);

  // Submit request
  console.log('\n📝 Submitting request to contract...');
  const tx = await registry.submitRequest(
    ipfsCID,
    category,
    validFrom,
    deadline,
    2, // AnswerFormat.SingleEntity
    bondRequired,
    reward
  );

  console.log('Transaction hash:', tx.hash);
  console.log('⏳ Waiting for confirmation...');
  const receipt = await tx.wait();

  // Get request ID from event
  const event = receipt.logs.find(log => {
    try {
      const parsed = registry.interface.parseLog(log);
      return parsed.name === 'RequestSubmitted';
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = registry.interface.parseLog(event);
    const requestId = parsed.args.requestId;
    console.log('\n✅ Request submitted successfully!');
    console.log(`   Request ID: ${requestId}`);
    console.log(`   IPFS CID: ${ipfsCID}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`\n🔗 View on IPFS: https://ipfs.io/ipfs/${ipfsCID}`);
  } else {
    console.log('\n✅ Request submitted (could not parse event)');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
