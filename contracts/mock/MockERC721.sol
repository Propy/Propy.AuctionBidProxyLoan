//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol"; 
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC721 is ERC721, AccessControl, Ownable {

  using Counters for Counters.Counter;
  Counters.Counter private _tokenIdCounter;

  event TokenMinted(uint256 indexed tokenId, string indexed tokenURI);
  event TokenURIUpdated(uint256 indexed tokenId, string indexed tokenURI);
  event TokenMetadataLocked(uint256 indexed tokenId);
  event TokenMetadataUnlocked(uint256 indexed tokenId);
  event ContractURIUpdated(string indexed contractURI);

  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // can mint -> 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
  bytes32 public constant METADATA_LOCKER_ROLE = keccak256("METADATA_LOCKER_ROLE"); // can lock metadata -> 0x0af1a227e20c738dadfc76971d0d110fd4b320a2b47db610f169242cda7cbd7e
  bytes32 public constant TOKEN_URI_UPDATER_ROLE = keccak256("TOKEN_URI_UPDATER_ROLE"); // can update tokenURI -> 0xd610886bde7b9b3561f4ecdece11096467246c56f3a9958246e8d8b56500f923
  bytes32 public constant CONTRACT_URI_UPDATER_ROLE = keccak256("CONTRACT_URI_UPDATER_ROLE"); // can update contractURI -> 0xa9268e694ac7275a7b48347399b83305791087d40fd36a11330099e5e322b4cd

  struct Token {
    uint256 tokenId;
    string tokenURI;
    bool isMetadataLocked;
  }

  mapping (uint256 => Token) internal tokens;

  string public contractURI;

  // Token name
  string private _name;

  // Token symbol
  string private _symbol;

  constructor(
    address _roleAdmin,
    string memory _tokenName,
    string memory _tokenSymbol,
    string memory _contractURI
  ) ERC721(_tokenName, _tokenSymbol) {
    _name = _tokenName;
    _symbol = _tokenSymbol;
    contractURI = _contractURI;
    _transferOwnership(_roleAdmin);
    _setupRole(DEFAULT_ADMIN_ROLE, _roleAdmin);
    _setupRole(MINTER_ROLE, _roleAdmin);
    _setupRole(METADATA_LOCKER_ROLE, _roleAdmin);
    _setupRole(TOKEN_URI_UPDATER_ROLE, _roleAdmin);
    _setupRole(CONTRACT_URI_UPDATER_ROLE, _roleAdmin);
  }

  modifier onlyMinter() {
    require(hasRole(MINTER_ROLE, msg.sender), "NOT_MINTER");
    _;
  }

  modifier onlyContractURIUpdater() {
    require(hasRole(CONTRACT_URI_UPDATER_ROLE, msg.sender), "NOT_CONTRACT_URI_UPDATER");
    _;
  }

  modifier onlyTokenURIUpdater() {
    require(hasRole(TOKEN_URI_UPDATER_ROLE, msg.sender), "NOT_TOKEN_URI_UPDATER");
    _;
  }

  modifier onlyMetadataLocker() {
    require(hasRole(METADATA_LOCKER_ROLE, msg.sender), "NOT_METADATA_LOCKER");
    _;
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function mint(
    address _to,
    string memory _tokenURI
  ) public onlyMinter {
    require(bytes(_tokenURI).length > 0, "EMPTY_TOKEN_URI");
    _tokenIdCounter.increment();
    _mint(_to, _tokenIdCounter.current());
    tokens[_tokenIdCounter.current()] = Token(
      _tokenIdCounter.current(),
      _tokenURI,
      false
    );
    emit TokenMinted(_tokenIdCounter.current(), _tokenURI);
  }

  // UPDATE METADATA FUNCTIONS

  function updateTokenNameAndSymbol(
    string memory _tokenName,
    string memory _tokenSymbol
  ) public onlyOwner {
    _name = _tokenName;
    _symbol = _tokenSymbol;
  }

  function updateContractURI(
    string memory _contractURI
  ) public onlyContractURIUpdater {
    contractURI = _contractURI;
    emit ContractURIUpdated(_contractURI);
  }

  function updateTokenURI(
    uint256 _tokenId,
    string memory _tokenURI
  ) public onlyTokenURIUpdater {
    require(bytes(_tokenURI).length > 0, "EMPTY_TOKEN_URI");
    require(_exists(_tokenId), "INVALID_TOKEN_ID");
    Token storage token = tokens[_tokenId];
    require(token.isMetadataLocked == false, "METADATA_LOCKED");
    token.tokenURI = _tokenURI;
    emit TokenURIUpdated(_tokenId, _tokenURI);
  }

  // VIEWS

  function name() public view virtual override returns (string memory) {
    return _name;
  }

  function symbol() public view virtual override returns (string memory) {
    return _symbol;
  }

  function tokenInfo(
    uint256 _tokenId
  ) public view returns (Token memory) {
    require(_exists(_tokenId), "INVALID_TOKEN_ID");
    return tokens[_tokenId];
  }

  function tokenURI(uint256 _tokenId) public view virtual override returns (string memory) {
    require(_exists(_tokenId), "INVALID_TOKEN_ID");
    return tokens[_tokenId].tokenURI;
  }

  // OPTIONAL METADATA LOCKING / UNLOCKING

  function lockMetadata(
    uint256 _tokenId
  ) public onlyMetadataLocker {
    require(_exists(_tokenId), "INVALID_TOKEN_ID");
    Token storage token = tokens[_tokenId];
    require(token.isMetadataLocked == false, "ALREADY_LOCKED");
    token.isMetadataLocked = true;
    emit TokenMetadataLocked(_tokenId);
  }

  function unlockMetadata(
    uint256 _tokenId
  ) public {
    require(_ownerOf(_tokenId) == msg.sender, "NOT_TOKEN_OWNER");
    Token storage token = tokens[_tokenId];
    require(token.isMetadataLocked == true, "ALREADY_UNLOCKED");
    token.isMetadataLocked = false;
    emit TokenMetadataUnlocked(_tokenId);
  }

}