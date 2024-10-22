// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CryptoTokenExchange is ReentrancyGuard, Ownable {
    IERC20 public cryptoToken;
    uint256 public feePercentage = 1; // 1% fee
    uint256 public constant FEE_DENOMINATOR = 1000;

    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    event TokensSold(address indexed seller, uint256 tokenAmount, uint256 ethAmount);
    event FeeUpdated(uint256 newFeePercentage);

    constructor(address _cryptoToken) {
        require(_cryptoToken != address(0), "Invalid token address");
        cryptoToken = IERC20(_cryptoToken);
    }

    function buyTokens() external payable nonReentrant {
        require(msg.value > 0, "Must send ETH to buy tokens");
        uint256 tokensToBuy = getTokenAmount(msg.value);
        require(tokensToBuy > 0, "Not enough ETH sent");
        require(cryptoToken.balanceOf(address(this)) >= tokensToBuy, "Insufficient liquidity");

        uint256 fee = (tokensToBuy * feePercentage) / FEE_DENOMINATOR;
        uint256 tokensToTransfer = tokensToBuy - fee;

        require(cryptoToken.transfer(msg.sender, tokensToTransfer), "Token transfer failed");
        emit TokensPurchased(msg.sender, msg.value, tokensToTransfer);
    }

    function sellTokens(uint256 tokenAmount) external nonReentrant {
        require(tokenAmount > 0, "Must sell a positive amount");
        uint256 ethToReceive = getEthAmount(tokenAmount);
        require(ethToReceive > 0, "Not enough tokens to sell");
        require(address(this).balance >= ethToReceive, "Insufficient liquidity");

        uint256 fee = (ethToReceive * feePercentage) / FEE_DENOMINATOR;
        uint256 ethToTransfer = ethToReceive - fee;

        require(cryptoToken.transferFrom(msg.sender, address(this), tokenAmount), "Token transfer failed");
        payable(msg.sender).transfer(ethToTransfer);
        emit TokensSold(msg.sender, tokenAmount, ethToTransfer);
    }

    function getTokenAmount(uint256 ethAmount) public view returns (uint256) {
        require(ethAmount > 0, "ETH amount must be greater than 0");
        return (ethAmount * 1000) / 1 ether; // 1 ETH = 1000 tokens
    }

    function getEthAmount(uint256 tokenAmount) public view returns (uint256) {
        require(tokenAmount > 0, "Token amount must be greater than 0");
        return (tokenAmount * 1 ether) / 1000; // 1000 tokens = 1 ETH
    }

    function setFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 50, "Fee percentage too high"); // Max 5% fee
        feePercentage = _feePercentage;
        emit FeeUpdated(_feePercentage);
    }

    function withdrawEth(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner()).transfer(amount);
    }

    function withdrawTokens(uint256 amount) external onlyOwner {
        require(amount <= cryptoToken.balanceOf(address(this)), "Insufficient token balance");
        require(cryptoToken.transfer(owner(), amount), "Token transfer failed");
    }

    receive() external payable {
        buyTokens();
    }
}