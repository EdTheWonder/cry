import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CryptoToken, CryptoTokenExchange } from "../typechain";

describe("CryptoTokenExchange", function () {
  let cryptoToken: CryptoToken;
  let exchange: CryptoTokenExchange;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const CryptoToken = await ethers.getContractFactory("CryptoToken");
    cryptoToken = await CryptoToken.deploy();
    await cryptoToken.deployed();

    const CryptoTokenExchange = await ethers.getContractFactory("CryptoTokenExchange");
    exchange = await CryptoTokenExchange.deploy(cryptoToken.address);
    await exchange.deployed();

    // Mint some tokens and approve the exchange
    await cryptoToken.mint(owner.address, ethers.utils.parseEther("1000000"));
    await cryptoToken.approve(exchange.address, ethers.constants.MaxUint256);
    await cryptoToken.transfer(exchange.address, ethers.utils.parseEther("100000"));
  });

  describe("Deployment", function () {
    it("Should set the right token", async function () {
      expect(await exchange.cryptoToken()).to.equal(cryptoToken.address);
    });

    it("Should set the right owner", async function () {
      expect(await exchange.owner()).to.equal(owner.address);
    });
  });

  describe("Buying tokens", function () {
    it("Should allow buying tokens", async function () {
      const ethAmount = ethers.utils.parseEther("1");
      await expect(exchange.connect(addr1).buyTokens({ value: ethAmount }))
        .to.emit(exchange, "TokensPurchased")
        .withArgs(addr1.address, ethAmount, ethers.utils.parseEther("990")); // 1% fee applied

      expect(await cryptoToken.balanceOf(addr1.address)).to.equal(ethers.utils.parseEther("990"));
    });

    it("Should fail when sending 0 ETH", async function () {
      await expect(exchange.connect(addr1).buyTokens({ value: 0 })).to.be.revertedWith("Must send ETH to buy tokens");
    });
  });

  describe("Selling tokens", function () {
    beforeEach(async function () {
      // Buy some tokens first
      await exchange.connect(addr1).buyTokens({ value: ethers.utils.parseEther("1") });
      await cryptoToken.connect(addr1).approve(exchange.address, ethers.constants.MaxUint256);
    });

    it("Should allow selling tokens", async function () {
      const tokenAmount = ethers.utils.parseEther("990");
      await expect(exchange.connect(addr1).sellTokens(tokenAmount))
        .to.emit(exchange, "TokensSold")
        .withArgs(addr1.address, tokenAmount, ethers.utils.parseEther("0.99")); // 1% fee applied

      expect(await cryptoToken.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should fail when selling 0 tokens", async function () {
      await expect(exchange.connect(addr1).sellTokens(0)).to.be.revertedWith("Must sell a positive amount");
    });
  });

  describe("Fee management", function () {
    it("Should allow owner to update fee", async function () {
      await expect(exchange.setFeePercentage(20))
        .to.emit(exchange, "FeeUpdated")
        .withArgs(20);

      expect(await exchange.feePercentage()).to.equal(20);
    });

    it("Should not allow non-owner to update fee", async function () {
      await expect(exchange.connect(addr1).setFeePercentage(20)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow setting fee too high", async function () {
      await expect(exchange.setFeePercentage(51)).to.be.revertedWith("Fee percentage too high");
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      // Buy some tokens to generate fees
      await exchange.connect(addr1).buyTokens({ value: ethers.utils.parseEther("10") });
    });

    it("Should allow owner to withdraw ETH", async function () {
      const initialBalance = await owner.getBalance();
      await exchange.withdrawEth(ethers.utils.parseEther("1"));
      const finalBalance = await owner.getBalance();
      expect(finalBalance.sub(initialBalance)).to.be.closeTo(ethers.utils.parseEther("1"), ethers.utils.parseEther("0.01"));
    });

    it("Should allow owner to withdraw tokens", async function () {
      const initialBalance = await cryptoToken.balanceOf(owner.address);
      await exchange.withdrawTokens(ethers.utils.parseEther("100"));
      const finalBalance = await cryptoToken.balanceOf(owner.address);
      expect(finalBalance.sub(initialBalance)).to.equal(ethers.utils.parseEther("100"));
    });

    it("Should not allow non-owner to withdraw", async function () {
      await expect(exchange.connect(addr1).withdrawEth(ethers.utils.parseEther("1"))).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(exchange.connect(addr1).withdrawTokens(ethers.utils.parseEther("100"))).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});