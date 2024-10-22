// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CryptoToken is ERC20, ERC20Burnable, Pausable, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens
    uint256 public constant RATE_LIMIT_PERIOD = 1 days;
    uint256 public constant RATE_LIMIT_AMOUNT = 10000000 * 10**18; // 10 million tokens per day

    mapping(address => uint256) private _lastMintTimestamp;
    mapping(address => uint256) private _mintedInPeriod;

    event RateLimitExceeded(address indexed minter, uint256 amount, uint256 timestamp);

    constructor() ERC20("CryptoToken", "CTK") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _rateLimitMint(to, amount);
        _mint(to, amount);
    }

    function _rateLimitMint(address to, uint256 amount) internal {
        uint256 currentTimestamp = block.timestamp;
        if (currentTimestamp - _lastMintTimestamp[to] >= RATE_LIMIT_PERIOD) {
            _lastMintTimestamp[to] = currentTimestamp;
            _mintedInPeriod[to] = amount;
        } else {
            require(_mintedInPeriod[to] + amount <= RATE_LIMIT_AMOUNT, "Rate limit exceeded");
            _mintedInPeriod[to] += amount;
        }
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC20, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}