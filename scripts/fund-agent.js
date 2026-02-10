// Script to fund agent wallet with CLAWCLE tokens
const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  console.log('💰 Funding Agent Wallet...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  // Agent wallet address
  const agentAddress = '0x34292d7C2303D44088f6699F3dFA5856fD8aAd26';
  
  // Contract addresses
  const tokenAddress = process.env.CLAWRACLE_TOKEN || '0xF1e9B3B3efdeE7576119426b40C4F85A4Bd59416';
  
  // Amount to send: 34,000 CLAWCLE
  const amount = ethers.parseEther('34000');
  
  // Get token contract
  const tokenABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)"
  ];
  
  const token = await ethers.getContractAt(tokenABI, tokenAddress, deployer);
  
  // Check deployer balance
  const deployerBalance = await token.balanceOf(deployer.address);
  console.log(`Deployer CLAWCLE Balance: ${ethers.formatEther(deployerBalance)} CLAWCLE`);
  
  if (deployerBalance < amount) {
    console.error(`❌ Insufficient balance! Need ${ethers.formatEther(amount)} CLAWCLE`);
    return;
  }
  
  // Check agent current balance
  const agentBalanceBefore = await token.balanceOf(agentAddress);
  console.log(`Agent Balance Before: ${ethers.formatEther(agentBalanceBefore)} CLAWCLE`);
  
  // Transfer tokens
  console.log(`\n📤 Transferring ${ethers.formatEther(amount)} CLAWCLE to agent...`);
  const tx = await token.transfer(agentAddress, amount);
  console.log('Transaction hash:', tx.hash);
  
  console.log('⏳ Waiting for confirmation...');
  await tx.wait();
  
  // Check agent balance after
  const agentBalanceAfter = await token.balanceOf(agentAddress);
  console.log(`\n✅ Transfer complete!`);
  console.log(`Agent Balance After: ${ethers.formatEther(agentBalanceAfter)} CLAWCLE`);
  console.log(`Amount sent: ${ethers.formatEther(amount)} CLAWCLE`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
