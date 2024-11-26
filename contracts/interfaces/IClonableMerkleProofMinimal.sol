// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.11;

interface IClonableMerkleProofMinimal {

  function initialize(bytes32 _merkleRoot) external;
  function isValidMerkleProof(bytes32[] calldata _merkleProof, address _address, uint256 _value) external view returns (bool);

}