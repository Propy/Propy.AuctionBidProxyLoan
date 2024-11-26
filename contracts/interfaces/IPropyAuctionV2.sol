// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import './IWhitelist.sol';

interface IPropyAuctionV2 {
    struct Auction {
        uint128 minBid;
        uint32 deadline;
        uint32 finalizeTimeout;
        bool finalized;
    }

    event TokensRecovered(address token, address to, uint value);
    event Bid(IERC721 nft, uint nftId, uint32 start, address user, uint value);
    event Claimed(IERC721 nft, uint nftId, uint32 start, address user, uint value);
    event Withdrawn(address user, uint value);
    event Finalized(IERC721 nft, uint nftId, uint32 start, address winner, uint winnerBid);
    event AuctionAdded(IERC721 nft, uint nftId, uint32 start, uint32 deadline, uint128 minBid, uint32 timeout);
    event MinBidUpdated(IERC721 nft, uint nftId, uint32 start, uint128 minBid);
    event DeadlineExtended(IERC721 nft, uint nftId, uint32 start, uint32 deadline);

    function whitelist() external view returns (IWhitelist);
    function unclaimed(address user) external view returns (uint);
    
    function getAuction(IERC721 _nft, uint _nftId, uint32 _start) external view returns(Auction memory);
    function getBid(IERC721 _nft, uint _nftId, uint32 _start, address _bidder) external view returns(uint);
    function bid(IERC721 _nft, uint _nftId, uint32 _start) external payable;
    
    function addAuction(
        IERC721 _nft,
        uint _nftId,
        uint32 _start,
        uint32 _deadline,
        uint128 _minBid,
        uint32 _finalizeTimeout
    ) external;
    
    function updateMinBid(IERC721 _nft, uint _nftId, uint32 _start, uint128 _minBid) external;
    function updateDeadline(IERC721 _nft, uint _nftId, uint32 _start, uint32 _deadline) external;
    
    function finalize(
        IERC721 _nft,
        uint _nftId,
        uint32 _start,
        address _winner,
        address[] memory _payoutAddresses,
        uint256[] memory _payoutAddressValues
    ) external;
    
    function claim(IERC721 _nft, uint _nftId, uint32 _start) external;
    function claimFor(IERC721 _nft, uint _nftId, uint32 _start, address _user) external;
    function withdraw() external;
    function withdrawFor(address _user) external;
    
    function claimAndWithdrawFor(
        IERC721 _nft,
        uint _nftId,
        uint32 _start,
        address[] calldata _users
    ) external;
    
    function claimAndWithdraw(IERC721 _nft, uint _nftId, uint32 _start) external;
    
    function recoverTokens(IERC20 _token, address _destination, uint _amount) external;
    function isDone(IERC721 _nft, uint _nftId, uint32 _start) external view returns(bool);
}