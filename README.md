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

## Commands

### Generate Merkle Root (merkleGen)

This repo includes a Hardhat task to generate a Merkle Root for a provided set of loan allowance data:

`npx hardhat merkleGen --merkle-data example-eth-values.json`

Replace `example-eth-values.json` with the name of the file in the `merkle-data` folder that you wish to generate the Merkle Root for