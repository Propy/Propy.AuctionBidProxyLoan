//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.11;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";

contract ClonableMerkleProofMinimal {

  bytes32 public merkleRoot;

  function initialize(bytes32 _merkleRoot) external {
    require(merkleRoot == bytes32(0x00), "ALREADY_INITIALIZED");
    merkleRoot = _merkleRoot;
  }

  function isValidMerkleProof(bytes32[] calldata _merkleProof, address _address, uint256 _value) external view returns (bool) {
    require(merkleRoot != bytes32(0x00), "NOT_INITIALIZED");
    bytes32 leaf = keccak256(abi.encodePacked(_address, _value));
    bool result = MerkleProofUpgradeable.verify(_merkleProof, merkleRoot, leaf);
    require(result, 'INVALID_MERKLE_PROOF');
    return result;
  }

}