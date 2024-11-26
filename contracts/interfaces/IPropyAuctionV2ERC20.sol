// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import './IPropyAuctionV2.sol';

interface IPropyAuctionV2ERC20 is IPropyAuctionV2 {
    function biddingToken() external view returns (IERC20);
    function bidToken(IERC721 _nft, uint _nftId, uint32 _start, uint _amount) external;
}