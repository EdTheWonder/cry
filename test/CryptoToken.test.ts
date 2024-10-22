import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CryptoToken } from "../typechain/CryptoToken";

describe("CryptoToken", function () {
  let cryptoToken: CryptoToken;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];

  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  const PAUSER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PAUSER_ROLE"));

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const CryptoToken = await ethers.getContractFactory("CryptoToken");
    cryptoToken = await CryptoToken.deploy();
    await cryptoToken.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await cryptoToken.hasRole(ethers.constants.HashZero, owner.address)).to.equal(true);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await cryptoToken.balanceOf(owner.address);
      expect(await cryptoToken.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("Minting", function () {
    it("Should allow minting by minter role", async function () {
      await cryptoToken.mint(addr1.address, ethers.utils.parseEther("100"));
      expect(await cryptoToken.balanceOf(addr1.address)).to.equal(ethers.utils.parseEther("100"));
    });

    it("Should not allow minting by non-minter", async function () {
      await expect(
        cryptoToken.connect(addr1).mint(addr2.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("AccessControl:");
    });

    it("Should respect max supply", async function () {
      const maxSupply = await cryptoToken.MAX_SUPPLY();
      await expect(
        cryptoToken.mint(addr1.address, maxSupply.add(1))
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("Should enforce rate limit", async function () {
      const rateLimit = await cryptoToken.RATE_LIMIT_AMOUNT();
      await cryptoToken.mint(addr1.address, rateLimit);
      await expect(
        cryptoToken.mint(addr1.address, 1)
      ).to.be.revertedWith("Rate limit exceeded");
    });

    it("Should reset rate limit after period", async function () {
      const rateLimit = await cryptoToken.RATE_LIMIT_AMOUNT();
      await cryptoToken.mint(addr1.address, rateLimit);
      
      // Increase time by 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        cryptoToken.mint(addr1.address, rateLimit)
      ).to.not.be.reverted;
    });
  });

  describe("Burning", function () {
    it("Should allow burning tokens", async function () {
      await cryptoToken.mint(addr1.address, ethers.utils.parseEther("100"));
      await cryptoToken.connect(addr1).burn(ethers.utils.parseEther("50"));
      expect(await cryptoToken.balanceOf(addr1.address)).to.equal(ethers.utils.parseEther("50"));
    });
  });

  describe("Pausing", function () {
    it("Should allow pausing by pauser role", async function () {
      await cryptoToken.pause();
      expect(await cryptoToken.paused()).to.equal(true);
    });

    it("Should not allow pausing by non-pauser", async function () {
      await expect(cryptoToken.connect(addr1).pause()).to.be.revertedWith("AccessControl:");
    });

    it("Should not allow transfers when paused", async function () {
      await cryptoToken.mint(addr1.address, ethers.utils.parseEther("100"));
      await cryptoToken.pause();
      await expect(
        cryptoToken.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("50"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow transfers after unpausing", async function () {
      await cryptoToken.mint(addr1.address, ethers.utils.parseEther("100"));
      await cryptoToken.pause();
      await cryptoToken.unpause();
      await expect(
        cryptoToken.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("50"))
      ).to.not.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should allow adding new minter", async function () {
      await cryptoToken.grantRole(MINTER_ROLE, addr1.address);
      expect(await cryptoToken.hasRole(MINTER_ROLE, addr1.address)).to.equal(true);
    });

    it("Should allow adding new pauser", async function () {
      await cryptoToken.grantRole(PAUSER_ROLE, addr1.address);
      expect(await cryptoToken.hasRole(PAUSER_ROLE, addr1.address)).to.equal(true);
    });

    it("Should allow revoking roles", async function () {
      await cryptoToken.grantRole(MINTER_ROLE, addr1.address);
      await cryptoToken.revokeRole(MINTER_ROLE, addr1.address);
      expect(await cryptoToken.hasRole(MINTER_ROLE, addr1.address)).to.equal(false);
    });
  });
});