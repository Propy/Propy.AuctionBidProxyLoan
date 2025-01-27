# Propy.AuctionBidProxyLoan

This project aims to plug into Propy's existing auction contracts in order to offer lending providers the ability to grant lending allowances to specified EVM addresses.

`ClonableAuctionBidProxyLoan.sol` plugs into a standard Propy auction contract (supports ETH & ERC-20 bidding), it also hooks into the existing whitelist contract that the Propy auction contract relies on as well as a clone of the `ClonableMerkleProofMinimal.sol` contract.

`ClonableMerkleProofMinimal.sol` stores the Merkle Root and handles Merkle Proof validations.

New instances (minimal clones) of the `ClonableAuctionBidProxyLoan.sol` & `ClonableMerkleProofMinimal.sol` contracts are deployed via the `BidProxyFactory.sol` contract.

The way that setting up loan allowances looks is that the first step is to build up a list of addresses along with their bidding allowances that have been granted by the lender, for example let’s consider an ETH auction, if we want to grant allowances to these example addresses, the lender should create a mapping of user wallet addresses to the max ETH amount they may make a bid with (in wei):

```
{
  "0x3826539Cbd8d68DCF119e80B994557B4278CeC9f": "100000000000000000000", // 100 ETH
  "0x1268AD189526AC0b386faF06eFfC46779c340eE6": "50000000000000000000", // 50 ETH
  "0x9B984D5a03980D8dc0a24506c968465424c81DbE": "200000000000000000000", // 200 ETH
  "0xc6e2459991BfE27cca6d86722F35da23A1E4Cb97": "10000000000000000000" // 10 ETH
}
```

This file should then be shared with Propy (it needs to be used via the frontend when users generate Merkle Proofs that prove their inclusion and max bid amount when making a proxy bid).

Propy additionally feeds this JSON to an internal tool (or see `merkleGen` command below) to generate the Merkle Root for the data shown above, in this example case the Merkle Root for the data shown above is `0x8f2fa3769da94489a9d9f92d6227da03777039926c2e08552092e59ab55425f5` and this is what will be used for the `bytes32 _merkleRoot` parameter when calling the `newBidProxyClone` function of `BidProxyFactory.sol`

Standard users make bids via the auction contract directly, users who want to leverage this lending feature make bids via the `ClonableAuctionBidProxyLoan.sol` deployed for the auction. Users can bid less than or equal to their max amount granted in the JSON above (as long as the existing bid is lower than their max amount). The cloned proxy bidding contract should have the full amount of the highest available allowance deposited into it so that bidders can use up to that amount, so in the example above we would expect `200 ETH` to be deposited into the proxy bidding contract (all bidders then share this source of funds, but each bidder can only use up to their own granted maximum to bid with).

At the end of the auction, if a lender won the auction, the proxy contract wins the auction from the perspective of Propy’s auction contract. The NFT then arrives in the proxy contract and the `forwardNftToWinner` function can be used to forward the NFT to the proxy bidder who won the auction.

# VERY IMPORTANT NOTE

One key difference between placing a bid via the `ClonableAuctionBidProxyLoan.sol` contracts compared to placing a bid via the standard `PropyAuctionV2`:

The `bid` function on `PropyAuctionV2` assumes that the provided bid amount (`msg.value` for ETH auctions and `_amount` on ERC20 auctions) is set to **the amount by which a user wants to increase their bid**, this means that if a user already has bid e.g. 10 ETH and wants to increase their bid to 25 ETH, they place a 15 ETH bid which will increase their existing bid of 10 ETH by 15 ETH -> 25 ETH

The `proxyBid` function on `ClonableAuctionBidProxyLoan.sol` takes a `_bidAmount` which is set to **the total bid amount that we want the user to arrive at**,  this means that if a user already has bid e.g. 10 ETH and wants to increase their bid to 25 ETH, they place a 25 ETH bid which will increase their existing bid of 10 ETH by 15 ETH -> 25 ETH

In other words: 

If a user is bidding via `PropyAuctionV2`, the value of their bid represents only the amount they want to increase their bid by.

If a user is bidding via `ClonableAuctionBidProxyLoan`, the value of their bid represents the full amount that they want their bid to be.

## Updating allowances on an existing clone

In order to update the allowances on an existing clone of `ClonableAuctionBidProxyLoan.sol`:

1. Use the `newMerkleProofClone` function on `BidProxyFactory` to deploy a new Merkle Proof clone, pull the `merkleRootClone` argument from the `NewMerkleRootClone` event to get the contract address of the new Merkle Proof clone which is emitted when calling the `newMerkleProofClone` function
2. Use the `updateMerkleProofContract` function on the deployed clone of the `ClonableAuctionBidProxyLoan.sol` contract, passing it the new `merkleRootClone` address that was taken from the `NewMerkleRootClone` event in step 1.

## Deployments

Sepolia BidProxyFactory: [`0x1375cD97504D8B952486eEC27C7d9531CD79F66e`](https://sepolia.etherscan.io/address/0x1375cD97504D8B952486eEC27C7d9531CD79F66e) (ownership assigned to `0x3426803C91c2e7892eB345Ac4769966196CD100B`)

## ABI

The ABI for interacting with `BidProxyFactory` can be found [here](https://github.com/Propy/Propy.AuctionBidProxyLoan/blob/main/abi/BidProxyFactoryABI.json).

The ABI for interacting with `ClonableAuctionBidProxyLoan` (a clone deployed by the `BidProxyFactory`) can be found [here](https://github.com/Propy/Propy.AuctionBidProxyLoan/blob/main/abi/ClonableAuctionBidProxyLoanABI.json).

The functionality of this repo is dependent upon 2 core contracts:

## BidProxyFactory.sol

- [BidProxyFactory.sol](https://github.com/Propy/Propy.AuctionBidProxyLoan/blob/main/contracts/BidProxyFactory.sol) is a contract which can be used to deploy new clones of the `ClonableAuctionBidProxyLoan.sol` contract

## ClonableAuctionBidProxyLoan.sol

- [ClonableAuctionBidProxyLoan.sol](https://github.com/Propy/Propy.AuctionBidProxyLoan/blob/main/contracts/references/ClonableAuctionBidProxyLoan.sol) is a contract which holds funds that are being borrowed to bidders, and enables a list of whitelisted bidders to make bids using borrowed funds.

## Overview/interface of BidProxyFactory.sol

Below we outline the key functions of the contract to get an quick overview of the functionality included in it (full contract can be found [here](https://github.com/Propy/Propy.AuctionBidProxyLoan/blob/main/contracts/BidProxyFactory.sol)).

```solidity
interface IBidProxyFactory is Ownable {

  // This is the main function we would expect to use
  // This deploys a new ClonableAuctionBidProxyLoan.sol & ClonableMerkleProofMinimal.sol and hooks them into each other
  function newBidProxyClone(
    bytes32 _merkleRoot,
    address _biddingTokenERC20Address,
    address _auctionDestination,
    address _nft,
    uint256 _nftId,
    uint32 _start,
    address _adminAddress,
    address _maintainerAddress
  ) external;

  // If allowances need to be updated on an already-deployed ClonableAuctionBidProxyLoan.sol
  // Then we call this function to deploy ONLY a new ClonableMerkleProofMinimal.sol
  // Extract the `merkleRootClone` address arg from the `NewMerkleRootClone` event
  // This emitted `merkleRootClone` address can then be used to update the ClonableAuctionBidProxyLoan.sol via `updateMerkleProofContract`
  function newMerkleProofClone(
    bytes32 _merkleRoot
  ) external;

  // If we want to update the config of this factory
  function adjustFactoryConfig(
    address _clonableAuctionBidProxyLoanReference,
    address _clonableMerkleProofMinimalReference,
    address _whitelist
  ) external;

  // Emitted when the factory creates a new clone of ClonableAuctionBidProxyLoan.sol & ClonableMerkleProofMinimal.sol
  event NewBidProxy(
    address indexed auctionDestination,
    address indexed bidProxy,
    address indexed bidToken,
    bytes32 merkleRoot,
    address nft,
    uint nftId,
    uint32 start
  );

  // Emitted when the factory creates a new clone of ONLY ClonableMerkleProofMinimal.sol
  event NewMerkleRootClone(
    address indexed merkleRootClone,
    bytes32 merkleRoot
  );

}
```

## Overview/interface of ClonableAuctionBidProxyLoan.sol

```solidity
interface IClonableAuctionBidProxyLoan is IERC721Receiver, IAccessControlUpgradeable, IReentrancyGuardUpgradeable {

  // This is the general config that we store for the target auction contract
  struct AuctionConfig {
    IERC20 biddingTokenERC20;
    address destination;
    IERC721 nft;
    uint256 nftId;
    uint32 start;
    address latestProxyBidder;
    uint256 latestProxyBidAmount;
  }

  // This function is automatically called by `newBidProxyClone` of the `BidProxyFactory.sol` contract when a new clone is deployed
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

  // This is the function that a borrower/user would call in order to place a bid in the target auction using borrowed funds
  function proxyBid(bytes32[] calldata _merkleProof, address _bidderAddress, uint256 _maxLoanAmount, uint256 _bidAmount) external;

  // This function enables the contract to receive ETH
  receive() external payable;

  // This function enables the contract to receive ERC721 tokens
  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external override returns (bytes4);

  // This is an admin function which can be called by the _maintainerAddress or _adminAddress which was provided to `newBidProxyClone` of `BidProxyFactory.sol`
  // This function is responsible for releasing the NFT to the winner of the auction
  function forwardNftToWinner(address _winner);

  // This is an admin function which can be called by the _maintainerAddress or _adminAddress which was provided to `newBidProxyClone` of `BidProxyFactory.sol`
  // This function can be used to pull bidding funds back into this contract from the target auction contract in a case where the auction ends without a proxy bidder winning
  function claimAndWithdrawBidFromAuction() external;

  // This is an admin function which can be called by the _maintainerAddress or _adminAddress which was provided to `newBidProxyClone` of `BidProxyFactory.sol`
  // This function can be used to update the merkle proof contract associate with this bidding proxy
  // Step 1 would be to use newMerkleProofClone from BidProxyFactory.sol to get a new merkleRootClone address
  // Step 2 would be to plug that new merkleRootClone address into here
  function updateMerkleProofContract(address _merkleProofAddress) external;

  // This is an admin function which can be called by the _maintainerAddress or _adminAddress which was provided to `newBidProxyClone` of `BidProxyFactory.sol`
  // This function can be used to update the overall config of this contract, however, once the first bid is placed via this proxy, this function can no longer be used
  function updateFullConfig(
    address _merkleProofAddress,
    address _whitelistAddress,
    address _biddingTokenERC20Address,
    address _auctionDestination,
    address _nft,
    uint256 _nftId,
    uint32 _start
  ) external;

  // This is an admin function which can be called by the _maintainerAddress or _adminAddress which was provided to `newBidProxyClone` of `BidProxyFactory.sol`
  // This EMERGENCY function can be used to extract ERC20 tokens from this contract
  function recoverTokens(IERC20 _token, address _destination, uint _amount) external;

  // This is an admin function which can be called by the _maintainerAddress or _adminAddress which was provided to `newBidProxyClone` of `BidProxyFactory.sol`
  // This EMERGENCY function can be used to extract ETH from this contract
  function recoverETH(address _destination, uint _amount) external;

  // This is an admin function which can be called by the _maintainerAddress or _adminAddress which was provided to `newBidProxyClone` of `BidProxyFactory.sol`
  // This EMERGENCY function can be used to extract ERC721 tokens from this contract
  function recoverERC721(IERC721 _token, uint _tokenId, address _destination, bool _safeTransfer) external;

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

}
```

## Commands

### Generate Merkle Root (merkleGen)

This repo includes a Hardhat task to generate a Merkle Root for a provided set of approved loan amounts for addresses:

`npx hardhat merkleGen --merkle-data example.json`

Replace `example.json` with the name of the file in the `merkle-data` folder that you wish to generate the Merkle Root for

### Installation

`npm install`

### Testing

Tests can be run using `npx hardhat test`

### Coverage

Test coverage can be derived using `npx hardhat coverage`

### Deployment

Deployment can be run using `npx hardhat run scripts/deploy-references-and-factory.js --network sepolia` (adjust network name to change destination of deployment)

## Versions

This repo was produced using `node v18.17.1` & `npm v9.6.7`