import { ethers } from "hardhat";
import { CryptoToken__factory, CryptoTokenExchange__factory } from "../typechain";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy CryptoToken
  const CryptoToken: CryptoToken__factory = await ethers.getContractFactory("CryptoToken");
  const cryptoToken = await CryptoToken.deploy();
  await cryptoToken.deployed();
  console.log("CryptoToken deployed to:", cryptoToken.address);

  // Deploy CryptoTokenExchange
  const CryptoTokenExchange: CryptoTokenExchange__factory = await ethers.getContractFactory("CryptoTokenExchange");
  const exchange = await CryptoTokenExchange.deploy(cryptoToken.address);
  await exchange.deployed();
  console.log("CryptoTokenExchange deployed to:", exchange.address);

  // Mint initial tokens and add liquidity to the exchange
  const initialLiquidity = ethers.utils.parseEther("100000");
  await cryptoToken.mint(deployer.address, initialLiquidity);
  await cryptoToken.approve(exchange.address, initialLiquidity);
  await cryptoToken.transfer(exchange.address, initialLiquidity);
  console.log("Added initial liquidity to the exchange");

  // Verify contracts on Polygonscan
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log("Verifying contracts on Polygonscan...");
    await run("verify:verify", {
      address: cryptoToken.address,
      constructorArguments: [],
    });
    await run("verify:verify", {
      address: exchange.address,
      constructorArguments: [cryptoToken.address],
    });
    console.log("Contracts verified on Polygonscan");
  } else {
    console.log("Skipping contract verification");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });