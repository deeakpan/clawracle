const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Deploying Clawracle to Monad Mainnet...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "MON\n");

  // Use existing token address (mainnet)
  const tokenAddress = "0x99FB9610eC9Ff445F990750A7791dB2c1F5d7777";
  console.log("📝 Using existing ClawracleToken at:", tokenAddress);
  
  // Verify token exists
  try {
    const token = await hre.ethers.getContractAt("ClawracleToken", tokenAddress);
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    console.log("✅ Token verified:", symbol);
    console.log("   Total Supply:", hre.ethers.formatEther(totalSupply), symbol);
  } catch (error) {
    console.warn("⚠️  Warning: Could not verify token contract:", error.message);
    console.log("   Continuing with deployment using provided address...");
  }

  // 1. Deploy DataRequestRegistry
  console.log("\n📝 Deploying DataRequestRegistry...");
  const DataRequestRegistry = await hre.ethers.getContractFactory("DataRequestRegistry");
  const registry = await DataRequestRegistry.deploy(tokenAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ DataRequestRegistry deployed to:", registryAddress);

  // 2. Deploy AgentRegistry
  console.log("\n📝 Deploying AgentRegistry...");
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("✅ AgentRegistry deployed to:", agentRegistryAddress);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ClawracleToken: tokenAddress,
      DataRequestRegistry: registryAddress,
      AgentRegistry: agentRegistryAddress
    }
  };

  const deploymentText = `# Clawracle Deployment (Mainnet)

Network: ${deploymentInfo.network}
Chain ID: ${deploymentInfo.chainId}
Deployer: ${deploymentInfo.deployer}
Timestamp: ${deploymentInfo.timestamp}

## Contract Addresses

ClawracleToken: ${tokenAddress} (existing, not deployed)
DataRequestRegistry: ${registryAddress}
AgentRegistry: ${agentRegistryAddress}

## Environment Variables

Update your .env file with:

\`\`\`bash
CLAWRACLE_TOKEN=${tokenAddress}
CLAWRACLE_REGISTRY=${registryAddress}
CLAWRACLE_AGENT_REGISTRY=${agentRegistryAddress}
\`\`\`

## Token Info

Using existing token at: ${tokenAddress}
Note: Token was not deployed in this script - using existing mainnet token

## Next Steps

1. Update .env with contract addresses
2. Update SKILL.md with contract addresses
3. Register your agent in AgentRegistry
4. Submit requests
5. Deploy agents using SKILL.md

## Verify Contracts (optional)

\`\`\`bash
npx hardhat verify --network ${deploymentInfo.network} ${registryAddress} "${tokenAddress}"
npx hardhat verify --network ${deploymentInfo.network} ${agentRegistryAddress}
\`\`\`
`;

  fs.writeFileSync("deployment-addresses.txt", deploymentText);
  fs.writeFileSync("deployment-info.json", JSON.stringify(deploymentInfo, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📄 Deployment details saved to:");
  console.log("  - deployment-addresses.txt");
  console.log("  - deployment-info.json");
  console.log("\n📋 Contract Addresses:");
  console.log("  ClawracleToken:        ", tokenAddress, "(existing)");
  console.log("  DataRequestRegistry:   ", registryAddress);
  console.log("  AgentRegistry:         ", agentRegistryAddress);
  console.log("\n✅ Using existing token on mainnet");
  console.log("   Requesters will approve and transfer reward tokens when submitting requests");
  console.log("\n🔗 Add to your .env:");
  console.log(`  CLAWRACLE_TOKEN=${tokenAddress}`);
  console.log(`  CLAWRACLE_REGISTRY=${registryAddress}`);
  console.log(`  CLAWRACLE_AGENT_REGISTRY=${agentRegistryAddress}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
