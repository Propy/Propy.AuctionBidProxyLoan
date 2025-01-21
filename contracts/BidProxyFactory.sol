//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "./interfaces/IWhitelist.sol";

interface IClonableAuctionBidProxyLoan {
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
  ) external;
}

interface IClonableMerkleProofMinimal {
  function initialize(bytes32 _merkleRoot) external;
}

contract BidProxyFactory is Ownable {

  event NewBidProxy(address indexed auctionDestination, address indexed bidProxy, address indexed bidToken, bytes32 merkleRoot, address nft, uint nftId, uint32 start);
  event NewMerkleRootClone(address indexed merkleRootClone, bytes32 indexed merkleRoot);

  address public clonableAuctionBidProxyLoanReference;
  address public clonableMerkleProofMinimalReference;
  address public whitelist;

  constructor(
    address _clonableAuctionBidProxyLoanReference,
    address _clonableMerkleProofMinimalReference,
    address _whitelist
  ) {
    require(_clonableAuctionBidProxyLoanReference != address(0), "INVALID_BID_PROXY_REF");
    require(_clonableMerkleProofMinimalReference != address(0), "INVALID_MERKLE_PROOF_REF");
    require(_whitelist != address(0), "INVALID_WHITELIST");
    clonableAuctionBidProxyLoanReference = _clonableAuctionBidProxyLoanReference;
    clonableMerkleProofMinimalReference = _clonableMerkleProofMinimalReference;
    whitelist = _whitelist;
  }

  function newBidProxyClone(
    bytes32 _merkleRoot,
    address _biddingTokenERC20Address,
    address _auctionDestination,
    address _nft,
    uint256 _nftId,
    uint32 _start,
    address _adminAddress,
    address _maintainerAddress
  ) external onlyOwner {
    // Deploy new merkle proof contract
    address _newMerkleProofCloneAddress = Clones.clone(clonableMerkleProofMinimalReference);
    IClonableMerkleProofMinimal _newMerkleProofClone = IClonableMerkleProofMinimal(_newMerkleProofCloneAddress);
    _newMerkleProofClone.initialize(_merkleRoot);
    // Deploy new bid proxy loan contract
    address _newAuctionBidProxyLoanCloneAddress = Clones.clone(clonableAuctionBidProxyLoanReference);
    IClonableAuctionBidProxyLoan _newAuctionBidProxyLoanClone = IClonableAuctionBidProxyLoan(_newAuctionBidProxyLoanCloneAddress);
    _newAuctionBidProxyLoanClone.initialize(
      _newMerkleProofCloneAddress,
      whitelist,
      _biddingTokenERC20Address,
      _auctionDestination,
      _nft,
      _nftId,
      _start,
      _adminAddress,
      _maintainerAddress
    );
    emit NewMerkleRootClone(_newMerkleProofCloneAddress, _merkleRoot);
    emit NewBidProxy(_auctionDestination, _newAuctionBidProxyLoanCloneAddress, _biddingTokenERC20Address, _merkleRoot, _nft, _nftId, _start);
  }

  function newMerkleProofClone(
    bytes32 _merkleRoot
  ) external onlyOwner {
    // Deploy new merkle proof contract
    address _newMerkleProofCloneAddress = Clones.clone(clonableMerkleProofMinimalReference);
    IClonableMerkleProofMinimal _newMerkleProofClone = IClonableMerkleProofMinimal(_newMerkleProofCloneAddress);
    _newMerkleProofClone.initialize(_merkleRoot);
    emit NewMerkleRootClone(_newMerkleProofCloneAddress, _merkleRoot);
  }

}