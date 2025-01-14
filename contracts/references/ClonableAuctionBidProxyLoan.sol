//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.11;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../interfaces/IClonableMerkleProofMinimal.sol";
import "../interfaces/IWhitelist.sol";
import "../interfaces/IPropyAuctionV2.sol";
import "../interfaces/IPropyAuctionV2ERC20.sol";

contract ClonableAuctionBidProxyLoan is IERC721Receiver, AccessControlUpgradeable, ReentrancyGuardUpgradeable {

  event ReceivedETH(address indexed sender, uint256 amount, string method);
  event SuccessfulProxyBidETH(address indexed proxyBidder, uint256 totalBidAmount, uint256 additionalFundsAdded);
  event SuccessfulProxyBidERC20(address indexed proxyBidder, address indexed biddingToken, uint256 totalBidAmount, uint256 additionalFundsAdded);
  event NFTForwardedToWinner(address indexed nft, uint256 indexed nftId, address indexed winner);
  event TokensRecovered(address token, address to, uint value);
  event ETHRecovered(address to, uint value);
  event ETHBidClaimedAndWithdrawnFromAuction(uint value);
  event ERC20BidClaimedAndWithdrawnFromAuction(uint value);
  event UpdatedMerkleProofContract(address indexed merkleProofContract);
  event UpdatedAuctionConfig(address indexed auctionDestination, address indexed bidToken, address indexed whitelistAddress, address nft, uint nftId, uint32 start);

  struct AuctionConfig {
    IERC20 biddingTokenERC20;
    address destination;
    IERC721 nft;
    uint256 nftId;
    uint32 start;
    address latestProxyBidder;
    uint256 latestProxyBidAmount;
  }

  bytes32 public constant MAINTAINER_ROLE = keccak256('MAINTAINER_ROLE'); // 0x339759585899103d2ace64958e37e18ccb0504652c81d4a1b8aa80fe2126ab95

  bool public initialized;
  IClonableMerkleProofMinimal public merkleProofContract;
  IWhitelist public whitelistContract;
  AuctionConfig public auctionConfig;

  function initialize(
    address _merkleProofAddress,
    address _whitelistAddress,
    address _biddingTokenERC20Address,
    address _auctionDestination,
    address _nft,
    uint256 _nftId,
    uint32 _start,
    address _adminAddress,
    address _maintainerAddress
  ) external {
    require(initialized == false, "ALREADY_INITIALIZED");
    require(_merkleProofAddress != address(0), "INVALID_MERKLE_PROOF_ADDRESS");
    require(_whitelistAddress != address(0), "INVALID_WHITELIST_ADDRESS");
    initialized = true;
    merkleProofContract = IClonableMerkleProofMinimal(_merkleProofAddress);
    whitelistContract = IWhitelist(_whitelistAddress);
    IERC20 _biddingToken = IERC20(_biddingTokenERC20Address);
    auctionConfig = AuctionConfig(
      _biddingToken,
      _auctionDestination,
      IERC721(_nft),
      _nftId,
      _start,
      address(0),
      0
    );
    if(_biddingTokenERC20Address != address(0)) {
      _biddingToken.approve(_auctionDestination, type(uint256).max);
    }
    _grantRole(DEFAULT_ADMIN_ROLE, _adminAddress);
    _grantRole(MAINTAINER_ROLE, _adminAddress);
    _grantRole(MAINTAINER_ROLE, _maintainerAddress);
  }

  function proxyBid(bytes32[] calldata _merkleProof, address _bidderAddress, uint256 _maxLoanAmount, uint256 _bidAmount) external {
    // Verify proof of max bid amount
    require(msg.sender == _bidderAddress, "INVALID_BIDDER_ADDRESS");
    require(whitelistContract.whitelist(_bidderAddress) == true, "BIDDER_NOT_WHITELISTED");
    require(_bidAmount <= _maxLoanAmount, "INSUFFICIENT_LOAN_ALLOWANCE");
    require(merkleProofContract.isValidMerkleProof(_merkleProof, _bidderAddress, _maxLoanAmount), "INVALID_MERKLE_PROOF");
    auctionConfig.latestProxyBidAmount = _bidAmount;
    auctionConfig.latestProxyBidder = _bidderAddress;
    if(address(auctionConfig.biddingTokenERC20) != address(0)) {
      // ERC20 BIDDING
      IPropyAuctionV2ERC20 _auctionContract = IPropyAuctionV2ERC20(auctionConfig.destination);
      uint256 currentBidByProxyAddress = _auctionContract.getBid(auctionConfig.nft, auctionConfig.nftId, auctionConfig.start, address(this));
      require(_bidAmount > currentBidByProxyAddress, "INVALID_BID_AMOUNT");
      uint256 _newBidTopupAmount = _bidAmount;
      if(currentBidByProxyAddress > 0) {
        _newBidTopupAmount = _bidAmount - currentBidByProxyAddress;
      }
      _auctionContract.bidToken(auctionConfig.nft, auctionConfig.nftId, auctionConfig.start, _newBidTopupAmount);
      emit SuccessfulProxyBidERC20(_bidderAddress, address(auctionConfig.biddingTokenERC20), _bidAmount, _newBidTopupAmount);
    } else {
      // ETH BIDDING
      IPropyAuctionV2 _auctionContract = IPropyAuctionV2(auctionConfig.destination);
      uint256 currentBidByProxyAddress = _auctionContract.getBid(auctionConfig.nft, auctionConfig.nftId, auctionConfig.start, address(this));
      require(_bidAmount > currentBidByProxyAddress, "INVALID_BID_AMOUNT");
      uint256 _newBidTopupAmount = _bidAmount;
      if(currentBidByProxyAddress > 0) {
        _newBidTopupAmount = _bidAmount - currentBidByProxyAddress;
      }
      _auctionContract.bid{value: _newBidTopupAmount}(auctionConfig.nft, auctionConfig.nftId, auctionConfig.start);
      emit SuccessfulProxyBidETH(_bidderAddress, _bidAmount, _newBidTopupAmount);
    }
  }

  receive() external payable {
    emit ReceivedETH(msg.sender, msg.value, "receive");
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external override returns (bytes4) {
    return this.onERC721Received.selector;
  }

  function forwardNftToWinner(
    address _winner
  ) external onlyMaintainer nonReentrant {
    require(_winner != address(0), "Invalid recipient address");
    
    auctionConfig.nft.safeTransferFrom(address(this), _winner, auctionConfig.nftId);
    
    emit NFTForwardedToWinner(address(auctionConfig.nft), auctionConfig.nftId, _winner);
  }

  function recoverTokens(IERC20 _token, address _destination, uint _amount) external onlyMaintainer nonReentrant {
    require(_destination != address(0), 'NO_ZERO_ADDRESS');
    _token.transfer(_destination, _amount);
    emit TokensRecovered(address(_token), _destination, _amount);
  }

  function recoverETH(address _destination, uint _amount) external onlyMaintainer nonReentrant {
    require(_destination != address(0), 'NO_ZERO_ADDRESS');
    (bool sent, ) = _destination.call{value: _amount}("");
    require(sent, "ETH_SEND_FAILED");
    emit ETHRecovered(_destination, _amount);
  }

  function claimAndWithdrawBidFromAuction() external onlyMaintainer {
    if(address(auctionConfig.biddingTokenERC20) != address(0)) {
      // ERC20 BIDDING
      IPropyAuctionV2ERC20 _auctionContract = IPropyAuctionV2ERC20(auctionConfig.destination);
      _auctionContract.claim(auctionConfig.nft, auctionConfig.nftId, auctionConfig.start);
      uint256 _withdrawAmount = _auctionContract.unclaimed(address(this));
      _auctionContract.withdraw();
      emit ERC20BidClaimedAndWithdrawnFromAuction(_withdrawAmount);
    } else {
      // ETH BIDDING
      IPropyAuctionV2 _auctionContract = IPropyAuctionV2(auctionConfig.destination);
      _auctionContract.claim(auctionConfig.nft, auctionConfig.nftId, auctionConfig.start);
      uint256 _withdrawAmount = _auctionContract.unclaimed(address(this));
      _auctionContract.withdraw();
      emit ETHBidClaimedAndWithdrawnFromAuction(_withdrawAmount);
    }
  }

  function updateMerkleProofContract(address _merkleProofAddress) external onlyMaintainer {
    require(_merkleProofAddress != address(0), "INVALID_MERKLE_PROOF_ADDRESS");
    merkleProofContract = IClonableMerkleProofMinimal(_merkleProofAddress);
    emit UpdatedMerkleProofContract(_merkleProofAddress);
  }

  function updateFullConfig(
    address _merkleProofAddress,
    address _whitelistAddress,
    address _biddingTokenERC20Address,
    address _auctionDestination,
    address _nft,
    uint256 _nftId,
    uint32 _start
  ) external onlyMaintainer {
    require(auctionConfig.latestProxyBidder == address(0), "ALREADY_IN_PROGRESS");
    require(_merkleProofAddress != address(0), "INVALID_MERKLE_PROOF_ADDRESS");
    require(_whitelistAddress != address(0), "INVALID_WHITELIST_ADDRESS");
    merkleProofContract = IClonableMerkleProofMinimal(_merkleProofAddress);
    emit UpdatedMerkleProofContract(_merkleProofAddress);
    whitelistContract = IWhitelist(_whitelistAddress);
    IERC20 _biddingToken = IERC20(_biddingTokenERC20Address);
    auctionConfig = AuctionConfig(
      _biddingToken,
      _auctionDestination,
      IERC721(_nft),
      _nftId,
      _start,
      address(0),
      0
    );
    if(_biddingTokenERC20Address != address(0)) {
      _biddingToken.approve(_auctionDestination, type(uint256).max);
    }
    emit UpdatedAuctionConfig(
      _auctionDestination,
      _biddingTokenERC20Address,
      _whitelistAddress,
      _nft,
      _nftId,
      _start
    );
  }

  modifier onlyMaintainer() {
    require(hasRole(MAINTAINER_ROLE, msg.sender), "NOT_MAINTAINER");
    _;
  }

}