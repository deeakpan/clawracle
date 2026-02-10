const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Deploying Clawracle to Monad...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "MON\n");

  // 1. Deploy ClawracleToken
  console.log("📝 Deploying ClawracleToken...");
  const ClawracleToken = await hre.ethers.getContractFactory("ClawracleToken");
  const initialSupply = hre.ethers.parseEther("1000000"); // 1 million tokens
  const token = await ClawracleToken.deploy(initialSupply);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ ClawracleToken deployed to:", tokenAddress);

  // 2. Deploy DataRequestRegistry
  console.log("\n📝 Deploying DataRequestRegistry...");
  const DataRequestRegistry = await hre.ethers.getContractFactory("DataRequestRegistry");
  const registry = await DataRequestRegistry.deploy(tokenAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ DataRequestRegistry deployed to:", registryAddress);

  // 3. Deploy AgentRegistry
  console.log("\n📝 Deploying AgentRegistry...");
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("✅ AgentRegistry deployed to:", agentRegistryAddress);

  // 4. All tokens remain with deployer (requesters will pay rewards when submitting requests)
  console.log("\n💰 Token distribution:");
  const deployerBalance = await token.balanceOf(deployer.address);
  console.log("✅ All", hre.ethers.formatEther(deployerBalance), "CLAWCLE tokens remain with deployer");
  console.log("   Requesters will approve and transfer rewards when submitting requests");

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

  const deploymentText = `# Clawracle Deployment

Network: ${deploymentInfo.network}
Chain ID: ${deploymentInfo.chainId}
Deployer: ${deploymentInfo.deployer}
Timestamp: ${deploymentInfo.timestamp}

## Contract Addresses

ClawracleToken: ${tokenAddress}
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

Symbol: CLAWCLE
Decimals: 18
Initial Supply: 1,000,000 CLAWCLE
Deployer Balance: 1,000,000 CLAWCLE (all tokens)
Note: Requesters must approve and transfer reward tokens when submitting requests

## Next Steps

1. Update .env with contract addresses
2. Update SKILL.md with contract addresses
3. Register your agent in AgentRegistry
4. Submit test requests
5. Deploy agents using SKILL.md

## Verify Contracts (optional)

\`\`\`bash
npx hardhat verify --network ${deploymentInfo.network} ${tokenAddress} "${initialSupply}"
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
  console.log("  ClawracleToken:        ", tokenAddress);
  console.log("  DataRequestRegistry:   ", registryAddress);
  console.log("  AgentRegistry:         ", agentRegistryAddress);
  console.log("\n✅ All tokens remain with deployer");
  console.log("   Requesters will pay rewards upfront when submitting requests");
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
