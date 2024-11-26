const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const BigNumber = require('bignumber.js');
const { merkleTreeGenerator, merkleTreeGenerateProof } = require('../utils');

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

describe("BidProxyFactory & ClonableAuctionBidProxyLoan", function () {

  const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
  const ADMIN_ROLE = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775";
  const MAINTAINER_ROLE = "0x339759585899103d2ace64958e37e18ccb0504652c81d4a1b8aa80fe2126ab95";

  let clonableAuctionBidProxyLoanReference, clonableMerkleProofMinimalReference, mockWhitelist, mockRWA, mockPRO, propyAuctionV2, propyAuctionV2ERC20;

  let deployerSigner, sellerSigner, adminSigner, maintainerSigner, standardBidder1Signer, standardBidder2Signer, proxyBidder1Signer, proxyBidder2Signer, bidder3SignerNoWhitelist;

  let loanPowerERC20 = {};
  let loanPowerETH = {};

  let merkleRootERC20;
  let merkleRootETH;

  let ethAuctionNftId = 1;
  let erc20AuctionNftId = 2;

  let auctionStartTime = Math.floor(new Date().getTime() / 1000) + (60 * 2);
  let auctionEndTime = Math.floor(new Date().getTime() / 1000) + (60 * 10);

  let bidProxyERC20;
  let bidProxyETH;

  let minBidEth = ethers.utils.parseUnits("5", 18).toString();
  let increasedBid = ethers.utils.parseUnits("10", 18).toString();
  let minBidERC20 = ethers.utils.parseUnits("5", 8).toString();
  let increasedBidERC20 = ethers.utils.parseUnits("10", 8).toString();

  let zeroAddress = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {

    await network.provider.send("hardhat_reset");

    [
      deployerSigner,
      maintainerSigner,
      adminSigner,
      standardBidder1Signer,
      standardBidder2Signer,
      proxyBidder1Signer,
      proxyBidder2Signer,
      bidder3SignerNoWhitelist,
      sellerSigner,
    ] = await hre.ethers.getSigners();

    console.log({
      proxyBidder1Signer: proxyBidder1Signer.address,
      proxyBidder2Signer: proxyBidder2Signer.address,
      bidder3SignerNoWhitelist: bidder3SignerNoWhitelist.address,
    })
    
    loanPowerERC20[proxyBidder1Signer.address] = ethers.utils.parseUnits("100", 8).toString();
    loanPowerERC20[proxyBidder2Signer.address] = ethers.utils.parseUnits("50", 8).toString();
    loanPowerERC20[bidder3SignerNoWhitelist.address] = ethers.utils.parseUnits("200", 8).toString();

    console.log({loanPowerERC20})

    merkleRootERC20 = await merkleTreeGenerator(loanPowerERC20);
    console.log({merkleRootERC20});

    loanPowerETH[proxyBidder1Signer.address] = ethers.utils.parseUnits("100", 18).toString();
    loanPowerETH[proxyBidder2Signer.address] = ethers.utils.parseUnits("50", 18).toString();
    loanPowerETH[bidder3SignerNoWhitelist.address] = ethers.utils.parseUnits("200", 18).toString();

    merkleRootETH = await merkleTreeGenerator(loanPowerETH);
    console.log({merkleRootETH});

    // Deploy mock version of PropyKeys tokens
    const MockERC721 = await ethers.getContractFactory("MockERC721");
    mockRWA = await MockERC721.deploy(
      deployerSigner.address,
      "MockNFT",
      "mNFT",
      ""
    );
    await mockRWA.deployed();
    await mockRWA.connect(deployerSigner).grantRole(MINTER_ROLE, deployerSigner.address);
    console.log({'mockRWA deployed to': mockRWA.address});

    // Deploy mock version of PRO tokens
    const MockPRO = await ethers.getContractFactory("MockPRO");
    mockPRO = await MockPRO.deploy(
      ethers.utils.parseUnits("100000", 8),
      8,
      "Base Propy",
      "bPRO"
    );
    await mockPRO.deployed();
    console.log({'mockPRO deployed to': mockPRO.address});

    // Deploy PropyKeyRepossession
    // address _roleAdmin,
    // address _propyKeysAddress,
    // address _propyOGAddress,
    // string memory _tokenURI
    const MockWhitelist = await ethers.getContractFactory("Whitelist");
    mockWhitelist = await MockWhitelist.deploy(
      deployerSigner.address
    );
    await mockWhitelist.deployed();
    console.log({'mockWhitelist deployed to': mockWhitelist.address});

    const ClonableMerkleProofMinimalReference = await ethers.getContractFactory("ClonableMerkleProofMinimal");
    clonableMerkleProofMinimalReference = await ClonableMerkleProofMinimalReference.deploy();
    await clonableMerkleProofMinimalReference.deployed();
    console.log({'clonableMerkleProofMinimalReference deployed to': clonableMerkleProofMinimalReference.address});

    const ClonableAuctionBidProxyLoanReference = await ethers.getContractFactory("ClonableAuctionBidProxyLoan");
    clonableAuctionBidProxyLoanReference = await ClonableAuctionBidProxyLoanReference.deploy();
    await clonableAuctionBidProxyLoanReference.deployed();
    console.log({'clonableAuctionBidProxyLoanReference deployed to': clonableAuctionBidProxyLoanReference.address});

    const BidProxyFactory = await ethers.getContractFactory("BidProxyFactory");
    bidProxyFactory = await BidProxyFactory.deploy(
      clonableAuctionBidProxyLoanReference.address,
      clonableMerkleProofMinimalReference.address,
      mockWhitelist.address,
    );
    await bidProxyFactory.deployed();
    console.log({'bidProxyFactory deployed to': bidProxyFactory.address});

    const PropyAuctionV2 = await ethers.getContractFactory("PropyAuctionV2");
    propyAuctionV2 = await PropyAuctionV2.deploy(
      deployerSigner.address,
      deployerSigner.address,
      deployerSigner.address,
      mockWhitelist.address,
    );
    await propyAuctionV2.deployed();
    console.log({'PropyAuctionV2 deployed to': propyAuctionV2.address});

    const PropyAuctionV2ERC20 = await ethers.getContractFactory("PropyAuctionV2ERC20");
    propyAuctionV2ERC20 = await PropyAuctionV2ERC20.deploy(
      deployerSigner.address,
      deployerSigner.address,
      deployerSigner.address,
      mockWhitelist.address,
      mockPRO.address,
    );
    await propyAuctionV2ERC20.deployed();
    console.log({'PropyAuctionV2ERC20 deployed to': propyAuctionV2ERC20.address});

    //addAuction(IERC721 _nft, uint _nftId, uint32 _start, uint32 _deadline, uint128 _minBid, uint32 _finalizeTimeout)

    // function newBidProxyClone(
    //   bytes32 _merkleRoot,
    //   address _biddingTokenERC20Address,
    //   address _auctionDestination,
    //   address _nft,
    //   uint256 _nftId,
    //   uint32 _start
    // )

    // set up a new auction with ETH bidding
    await mockRWA.mint(propyAuctionV2.address, "ipfs://");
    await propyAuctionV2.addAuction(mockRWA.address, ethAuctionNftId, auctionStartTime, auctionEndTime, minBidEth, 600);
    let newEthBidProxyTx = await bidProxyFactory.newBidProxyClone(merkleRootETH, zeroAddress, propyAuctionV2.address, mockRWA.address, ethAuctionNftId, auctionStartTime, adminSigner.address, maintainerSigner.address);
    let newEthBidProxyTxReceipt = await newEthBidProxyTx.wait();
    let newEthBidProxyEvent = newEthBidProxyTxReceipt.events.find((item) => item?.event === "NewBidProxy");
    let newEthBidProxyAddress = newEthBidProxyEvent.args.bidProxy;
    let BidProxyETH = await ethers.getContractFactory("ClonableAuctionBidProxyLoan");
    bidProxyETH = await BidProxyETH.attach(newEthBidProxyAddress);
    // top up bid proxy with max loan's amount of ETH
    let deployerSignerBalance = await bidProxyETH.provider.getBalance(deployerSigner.address);
    console.log({deployerSignerBalance})
    await deployerSigner.sendTransaction({
      to: bidProxyETH.address,
      value: ethers.utils.parseEther("100"),
    });
    let bidProxyEthBalance = await bidProxyETH.provider.getBalance(bidProxyETH.address);
    console.log({'bidProxyETH Address': bidProxyETH.address, 'bidProxyEthBalance': bidProxyEthBalance})

    // set up a new auction with ERC20 bidding
    await mockRWA.mint(propyAuctionV2ERC20.address, "ipfs://");
    await propyAuctionV2ERC20.addAuction(mockRWA.address, erc20AuctionNftId, auctionStartTime, auctionEndTime, minBidERC20, 600);
    let newERC20BidProxyTx = await bidProxyFactory.newBidProxyClone(merkleRootERC20, mockPRO.address, propyAuctionV2ERC20.address, mockRWA.address, erc20AuctionNftId, auctionStartTime, adminSigner.address, maintainerSigner.address);
    let newERC20BidProxyTxReceipt = await newERC20BidProxyTx.wait();
    let newERC20BidProxyEvent = newERC20BidProxyTxReceipt.events.find((item) => item?.event === "NewBidProxy");
    let newERC20BidProxyAddress = newERC20BidProxyEvent.args.bidProxy;
    let BidProxyERC20 = await ethers.getContractFactory("ClonableAuctionBidProxyLoan");
    bidProxyERC20 = await BidProxyERC20.attach(newERC20BidProxyAddress);
    // top up bid proxy with max loan's amount of ERC20 token
    await mockPRO.transfer(bidProxyERC20.address, ethers.utils.parseUnits("100", 8));
    let bidProxyERC20Balance = await mockPRO.balanceOf(bidProxyERC20.address);
    console.log({'bidProxyERC20 Address': bidProxyERC20.address, 'bidProxyERC20Balance': bidProxyERC20Balance})
    // top up standard bidders with ERC20 token
    await mockPRO.transfer(standardBidder1Signer.address, ethers.utils.parseUnits("1000", 8));
    await mockPRO.transfer(standardBidder2Signer.address, ethers.utils.parseUnits("1000", 8));

    // Whitelist all required addresses
    await mockWhitelist.batchAddToWhitelist([bidProxyERC20.address, bidProxyETH.address, standardBidder1Signer.address, standardBidder2Signer.address, proxyBidder1Signer.address, proxyBidder2Signer.address]);

  });
  context("state-modifying functions", async function () {
    context("function proxyBid for ETH auctions", async function () {
      context("Success cases", async function () {
        it("Should allow a whitelisted address to bid on an auction", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerETH[proxyBidder1Signer.address]} ETH`);
          let merkleProof = await merkleTreeGenerateProof(loanPowerETH, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address]);
          console.log({merkleProof});
          await expect(
            bidProxyETH.connect(proxyBidder1Signer).proxyBid(merkleProof, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address], minBidEth)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
        });
        it("Should allow a whitelisted address to increase their existing bid on an auction", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerETH[proxyBidder1Signer.address]} ETH`);
          let merkleProof = await merkleTreeGenerateProof(loanPowerETH, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address]);
          console.log({merkleProof});
          await expect(
            bidProxyETH.connect(proxyBidder1Signer).proxyBid(merkleProof, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address], minBidEth)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await expect(
            bidProxyETH.connect(proxyBidder1Signer).proxyBid(merkleProof, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address], increasedBid)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
        });
        it("Should allow ANOTHER whitelisted address to increase the bid when there is already an existing bid on an auction from a different whitelisted address", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerETH[proxyBidder1Signer.address]} ETH`);
          let merkleProofAddress1 = await merkleTreeGenerateProof(loanPowerETH, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address]);
          console.log({merkleProofAddress1});
          await expect(
            bidProxyETH.connect(proxyBidder1Signer).proxyBid(merkleProofAddress1, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address], minBidEth)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          let merkleProofAddress2 = await merkleTreeGenerateProof(loanPowerETH, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address]);
          console.log({merkleProofAddress2});
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address], increasedBid)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
        });
        it("Should allow whitelisted proxyBid addresses to get into a bidding war with standard bidders", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerETH[proxyBidder1Signer.address]} ETH`);
          let merkleProofAddress1 = await merkleTreeGenerateProof(loanPowerETH, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address]);
          console.log({merkleProofAddress1});
          await expect(
            bidProxyETH.connect(proxyBidder1Signer).proxyBid(merkleProofAddress1, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address], minBidEth)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await expect(
            propyAuctionV2.connect(standardBidder1Signer).bid(mockRWA.address, ethAuctionNftId, auctionStartTime, {value: BigNumber(minBidEth).plus(100).toString()})
          ).to.emit(propyAuctionV2, "Bid");
          let merkleProofAddress2 = await merkleTreeGenerateProof(loanPowerETH, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address]);
          console.log({merkleProofAddress2});
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address], increasedBid)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await expect(
            propyAuctionV2.connect(standardBidder2Signer).bid(mockRWA.address, ethAuctionNftId, auctionStartTime, {value: BigNumber(increasedBid).plus(100).toString()})
          ).to.emit(propyAuctionV2, "Bid");
        });
        it("Should allow the bidProxy contract to win the auction", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerETH[proxyBidder1Signer.address]} ETH`);
          let merkleProofAddress1 = await merkleTreeGenerateProof(loanPowerETH, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address]);
          console.log({merkleProofAddress1});
          await expect(
            bidProxyETH.connect(proxyBidder1Signer).proxyBid(merkleProofAddress1, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address], minBidEth)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await expect(
            propyAuctionV2.connect(standardBidder1Signer).bid(mockRWA.address, ethAuctionNftId, auctionStartTime, {value: BigNumber(minBidEth).plus(100).toString()})
          ).to.emit(propyAuctionV2, "Bid");
          let merkleProofAddress2 = await merkleTreeGenerateProof(loanPowerETH, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address]);
          console.log({merkleProofAddress2});
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address], increasedBid)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await expect(
            propyAuctionV2.connect(standardBidder2Signer).bid(mockRWA.address, ethAuctionNftId, auctionStartTime, {value: BigNumber(increasedBid).plus(100).toString()})
          ).to.emit(propyAuctionV2, "Bid");
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address], BigNumber(increasedBid).plus(200).toString())
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await time.setNextBlockTimestamp(auctionEndTime + 1);
          // function finalize(
          //   IERC721 _nft,
          //   uint _nftId,
          //   uint32 _start,
          //   address _winner,
          //   address[] memory _payoutAddresses,
          //   uint256[] memory _payoutAddressValues
          // ) external onlyRole(FINALIZE_ROLE) {
          let winningBid = await propyAuctionV2.getBid(mockRWA.address, ethAuctionNftId, auctionStartTime, bidProxyETH.address);
          console.log({winningBid, 'BigNumber(increasedBid).plus(200).toString()': BigNumber(increasedBid).plus(200).toString()});
          await expect(
            propyAuctionV2.finalize(mockRWA.address, ethAuctionNftId, auctionStartTime, bidProxyETH.address, [sellerSigner.address], [BigNumber(increasedBid).plus(200).toString()])
          ).to.emit(propyAuctionV2, "Finalized");
          let currentOwner = await mockRWA.ownerOf(ethAuctionNftId);
          await expect(currentOwner).to.equal(bidProxyETH.address);
        });
        it("The bidProxy admin should be able to forward the NFT to the winning bidder when the bidProxy wins the auction", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerETH[proxyBidder1Signer.address]} ETH`);
          let merkleProofAddress1 = await merkleTreeGenerateProof(loanPowerETH, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address]);
          console.log({merkleProofAddress1});
          await expect(
            bidProxyETH.connect(proxyBidder1Signer).proxyBid(merkleProofAddress1, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address], minBidEth)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await expect(
            propyAuctionV2.connect(standardBidder1Signer).bid(mockRWA.address, ethAuctionNftId, auctionStartTime, {value: BigNumber(minBidEth).plus(100).toString()})
          ).to.emit(propyAuctionV2, "Bid");
          let merkleProofAddress2 = await merkleTreeGenerateProof(loanPowerETH, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address]);
          console.log({merkleProofAddress2});
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address], increasedBid)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await expect(
            propyAuctionV2.connect(standardBidder2Signer).bid(mockRWA.address, ethAuctionNftId, auctionStartTime, {value: BigNumber(increasedBid).plus(100).toString()})
          ).to.emit(propyAuctionV2, "Bid");
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address], BigNumber(increasedBid).plus(200).toString())
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await time.setNextBlockTimestamp(auctionEndTime + 1);
          // function finalize(
          //   IERC721 _nft,
          //   uint _nftId,
          //   uint32 _start,
          //   address _winner,
          //   address[] memory _payoutAddresses,
          //   uint256[] memory _payoutAddressValues
          // ) external onlyRole(FINALIZE_ROLE) {
          let winningBid = await propyAuctionV2.getBid(mockRWA.address, ethAuctionNftId, auctionStartTime, bidProxyETH.address);
          console.log({winningBid, 'BigNumber(increasedBid).plus(200).toString()': BigNumber(increasedBid).plus(200).toString()});
          await expect(
            propyAuctionV2.finalize(mockRWA.address, ethAuctionNftId, auctionStartTime, bidProxyETH.address, [sellerSigner.address], [BigNumber(increasedBid).plus(200).toString()])
          ).to.emit(propyAuctionV2, "Finalized");
          let currentOwner = await mockRWA.ownerOf(ethAuctionNftId);
          await expect(currentOwner).to.equal(bidProxyETH.address);
          await expect(
            bidProxyETH.connect(adminSigner).forwardNftToWinner(proxyBidder2Signer.address)
          ).to.emit(bidProxyETH, "NFTForwardedToWinner");
        })
      })
    })
    context("function proxyBid for ERC20 auctions", async function () {
      context("Success cases", async function () {
        it("Should allow a whitelisted address to bid on an auction", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerERC20[proxyBidder1Signer.address]} ERC20`);
          let merkleProof = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address]);
          console.log({merkleProof});
          await expect(
            bidProxyERC20.connect(proxyBidder1Signer).proxyBid(merkleProof, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address], minBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
        });
        it("Should allow a whitelisted address to increase their existing bid on an auction", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerERC20[proxyBidder1Signer.address]} ERC20`);
          let merkleProof = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address]);
          console.log({merkleProof});
          await expect(
            bidProxyERC20.connect(proxyBidder1Signer).proxyBid(merkleProof, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address], minBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          await expect(
            bidProxyERC20.connect(proxyBidder1Signer).proxyBid(merkleProof, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address], increasedBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
        });
        it("Should allow ANOTHER whitelisted address to increase the bid when there is already an existing bid on an auction from a different whitelisted address", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerERC20[proxyBidder1Signer.address]} ERC20`);
          let merkleProofAddress1 = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address]);
          console.log({merkleProofAddress1});
          await expect(
            bidProxyERC20.connect(proxyBidder1Signer).proxyBid(merkleProofAddress1, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address], minBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          let merkleProofAddress2 = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address]);
          console.log({merkleProofAddress2});
          await expect(
            bidProxyERC20.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address], increasedBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
        })
        it("Should allow whitelisted proxyBid addresses to get into a bidding war with standard bidders", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerERC20[proxyBidder1Signer.address]} ERC20`);
          let merkleProofAddress1 = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address]);
          console.log({merkleProofAddress1});
          await expect(
            bidProxyERC20.connect(proxyBidder1Signer).proxyBid(merkleProofAddress1, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address], minBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          await mockPRO.connect(standardBidder1Signer).approve(propyAuctionV2ERC20.address, BigNumber(minBidERC20).plus(100).toString());
          await expect(
            propyAuctionV2ERC20.connect(standardBidder1Signer).bidToken(mockRWA.address, erc20AuctionNftId, auctionStartTime, BigNumber(minBidERC20).plus(100).toString())
          ).to.emit(propyAuctionV2ERC20, "Bid");
          let merkleProofAddress2 = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address]);
          console.log({merkleProofAddress2});
          await expect(
            bidProxyERC20.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address], increasedBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          await mockPRO.connect(standardBidder2Signer).approve(propyAuctionV2ERC20.address, BigNumber(increasedBidERC20).plus(100).toString());
          await expect(
            propyAuctionV2ERC20.connect(standardBidder2Signer).bidToken(mockRWA.address, erc20AuctionNftId, auctionStartTime, BigNumber(increasedBidERC20).plus(100).toString())
          ).to.emit(propyAuctionV2ERC20, "Bid");
        });
        it("Should allow the bidProxy contract to win the auction", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerERC20[proxyBidder1Signer.address]} ERC20`);
          let merkleProofAddress1 = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address]);
          console.log({merkleProofAddress1});
          await expect(
            bidProxyERC20.connect(proxyBidder1Signer).proxyBid(merkleProofAddress1, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address], minBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          await mockPRO.connect(standardBidder1Signer).approve(propyAuctionV2ERC20.address, BigNumber(minBidERC20).plus(100).toString());
          await expect(
            propyAuctionV2ERC20.connect(standardBidder1Signer).bidToken(mockRWA.address, erc20AuctionNftId, auctionStartTime, BigNumber(minBidERC20).plus(100).toString())
          ).to.emit(propyAuctionV2ERC20, "Bid");
          await mockPRO.connect(standardBidder2Signer).approve(propyAuctionV2ERC20.address, BigNumber(increasedBidERC20).plus(100).toString());
          await expect(
            propyAuctionV2ERC20.connect(standardBidder2Signer).bidToken(mockRWA.address, erc20AuctionNftId, auctionStartTime, BigNumber(increasedBidERC20).plus(100).toString())
          ).to.emit(propyAuctionV2ERC20, "Bid");
          let merkleProofAddress2 = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address]);
          console.log({merkleProofAddress2});
          await expect(
            bidProxyERC20.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address], BigNumber(increasedBidERC20).plus(200).toString())
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          await time.setNextBlockTimestamp(auctionEndTime + 1);
          // function finalize(
          //   IERC721 _nft,
          //   uint _nftId,
          //   uint32 _start,
          //   address _winner,
          //   address[] memory _payoutAddresses,
          //   uint256[] memory _payoutAddressValues
          // ) external onlyRole(FINALIZE_ROLE) {
          let winningBid = await propyAuctionV2ERC20.getBid(mockRWA.address, erc20AuctionNftId, auctionStartTime, bidProxyERC20.address);
          console.log({winningBid, 'BigNumber(increasedBidERC20).plus(200).toString()': BigNumber(increasedBidERC20).plus(200).toString()});
          await expect(
            propyAuctionV2ERC20.finalize(mockRWA.address, erc20AuctionNftId, auctionStartTime, bidProxyERC20.address, [sellerSigner.address], [BigNumber(increasedBidERC20).plus(200).toString()])
          ).to.emit(propyAuctionV2ERC20, "Finalized");
          let currentOwner = await mockRWA.ownerOf(erc20AuctionNftId);
          await expect(currentOwner).to.equal(bidProxyERC20.address);
        });
        it("The bidProxy admin should be able to forward the NFT to the winning bidder when the bidProxy wins the auction", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerERC20[proxyBidder1Signer.address]} ERC20`);
          let merkleProofAddress1 = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address]);
          console.log({merkleProofAddress1});
          await expect(
            bidProxyERC20.connect(proxyBidder1Signer).proxyBid(merkleProofAddress1, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address], minBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          await mockPRO.connect(standardBidder1Signer).approve(propyAuctionV2ERC20.address, BigNumber(minBidERC20).plus(100).toString());
          await expect(
            propyAuctionV2ERC20.connect(standardBidder1Signer).bidToken(mockRWA.address, erc20AuctionNftId, auctionStartTime, BigNumber(minBidERC20).plus(100).toString())
          ).to.emit(propyAuctionV2ERC20, "Bid");
          await mockPRO.connect(standardBidder2Signer).approve(propyAuctionV2ERC20.address, BigNumber(increasedBidERC20).plus(100).toString());
          await expect(
            propyAuctionV2ERC20.connect(standardBidder2Signer).bidToken(mockRWA.address, erc20AuctionNftId, auctionStartTime, BigNumber(increasedBidERC20).plus(100).toString())
          ).to.emit(propyAuctionV2ERC20, "Bid");
          let merkleProofAddress2 = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address]);
          console.log({merkleProofAddress2});
          await expect(
            bidProxyERC20.connect(proxyBidder2Signer).proxyBid(merkleProofAddress2, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address], BigNumber(increasedBidERC20).plus(200).toString())
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          await time.setNextBlockTimestamp(auctionEndTime + 1);
          // function finalize(
          //   IERC721 _nft,
          //   uint _nftId,
          //   uint32 _start,
          //   address _winner,
          //   address[] memory _payoutAddresses,
          //   uint256[] memory _payoutAddressValues
          // ) external onlyRole(FINALIZE_ROLE) {
          let winningBid = await propyAuctionV2ERC20.getBid(mockRWA.address, erc20AuctionNftId, auctionStartTime, bidProxyERC20.address);
          console.log({winningBid, 'BigNumber(increasedBidERC20).plus(200).toString()': BigNumber(increasedBidERC20).plus(200).toString()});
          await expect(
            propyAuctionV2ERC20.finalize(mockRWA.address, erc20AuctionNftId, auctionStartTime, bidProxyERC20.address, [sellerSigner.address], [BigNumber(increasedBidERC20).plus(200).toString()])
          ).to.emit(propyAuctionV2ERC20, "Finalized");
          let currentOwner = await mockRWA.ownerOf(erc20AuctionNftId);
          await expect(currentOwner).to.equal(bidProxyERC20.address);
          await expect(
            bidProxyERC20.connect(adminSigner).forwardNftToWinner(proxyBidder2Signer.address)
          ).to.emit(bidProxyERC20, "NFTForwardedToWinner");
        });
      })
    })
    // context("function setTokenURI", async function () {
    //   context("Failure cases", async function () {
    //     it("Should NOT ALLOW an address WITHOUT the APPROVER role to set the tokenURI", async function () {
    //       await expect(
    //         propyKeyRepo.connect(randomAccountSigner).setTokenURI("1234")
    //       ).to.be.revertedWith("NOT_APPROVER")
    //     })
    //   })
    //   context("Success cases", async function () {
    //     it("Should ALLOW an address WITH the APPROVER role to set the tokenURI", async function () {
    //       await propyKeyRepo.setTokenURI("1234")
    //       expect(
    //         await propyKeyRepo.tokenURI()
    //       ).to.equal("1234");
    //       await propyKeyRepo.setTokenURI("4321")
    //       expect(
    //         await propyKeyRepo.tokenURI()
    //       ).to.equal("4321");
    //     })
    //   })
    // });
    // context("function setRepossessionConfig", async function () {
    //   context("Failure cases", async function () {
    //     it("Should NOT ALLOW an address WITHOUT the APPROVER role to set a repossession config", async function () {
    //       await expect(
    //         propyKeyRepo.connect(randomAccountSigner).setRepossessionConfig(
    //           1,
    //           true,
    //           1,
    //           0
    //         )
    //       ).to.be.revertedWith("NOT_APPROVER")
    //     });
    //     it("Should NOT ALLOW a positive amountPropyOG if enabled is set to false", async function () {
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         1,
    //         0
    //       )
    //       await expect(
    //         propyKeyRepo.setRepossessionConfig(
    //           1,
    //           false,
    //           1,
    //           0
    //         )
    //       ).to.be.revertedWith("ZERO_OG_REQUIRED_ON_DISABLE")
    //     })
    //     it("Should NOT ALLOW a positive amountPRO if enabled is set to false", async function () {
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         0,
    //         1
    //       )
    //       await expect(
    //         propyKeyRepo.setRepossessionConfig(
    //           1,
    //           false,
    //           0,
    //           1
    //         )
    //       ).to.be.revertedWith("ZERO_PRO_REQUIRED_ON_DISABLE")
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         false,
    //         0,
    //         0
    //       )
    //     })
    //     it("Should NOT ALLOW a positive amountPRO if enabled is set to false", async function () {
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         0,
    //         1
    //       )
    //       await expect(
    //         propyKeyRepo.setRepossessionConfig(
    //           1,
    //           false,
    //           0,
    //           1,
    //         )
    //       ).to.be.revertedWith("ZERO_PRO_REQUIRED_ON_DISABLE")
    //     })
    //     it("Should NOT ALLOW a NO CHANGE call", async function () {
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         0,
    //         1
    //       )
    //       await expect(
    //         propyKeyRepo.setRepossessionConfig(
    //           1,
    //           true,
    //           0,
    //           1
    //         )
    //       ).to.be.revertedWith("NO_CHANGE")
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         1,
    //         0
    //       )
    //       await expect(
    //         propyKeyRepo.setRepossessionConfig(
    //           1,
    //           true,
    //           1,
    //           0
    //         )
    //       ).to.be.revertedWith("NO_CHANGE")
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         1,
    //         1
    //       )
    //     })
    //   })
    //   context("Success cases", async function () {
    //     it("Should ALLOW an address WITH the APPROVER role to setRepossessionConfig", async function () {
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         1,
    //         0
    //       )
    //     })
    //   })
    // })
    // context("function sweepTokenByFullBalance", async function () {
    //   context("Failure cases", async function () {
    //     it("Should NOT ALLOW a sweep from a non-sweeper address", async function () {
    //       await expect(
    //         propyKeyRepo.connect(randomAccountSigner).sweepTokenByFullBalance(
    //           mockPRO.address,
    //           deployerSigner.address
    //         )
    //       ).to.be.revertedWith("NOT_SWEEPER")
    //     });
    //     it("Should NOT ALLOW a sweep on a _tokenAddress which has zero balance", async function () {
    //       await expect(
    //         propyKeyRepo.sweepTokenByFullBalance(
    //           mockPRO.address,
    //           deployerSigner.address
    //         )
    //       ).to.be.revertedWith("NO_BALANCE")
    //     });
    //   })
    //   context("Success cases", async function () {
    //     it("Should ALLOW an address WITH the SWEEPER role to sweepTokenByFullBalance", async function () {
    //       await mockPRO.transfer(propyKeyRepo.address, ethers.utils.parseUnits("100", 8));
    //       await expect(
    //         propyKeyRepo.sweepTokenByFullBalance(
    //           mockPRO.address,
    //           deployerSigner.address
    //         )
    //       ).to.emit(propyKeyRepo, "TokenSwept");
    //     })
    //   })
    // })
    // context("function sweepETHByFullBalance", async function () {
    //   context("Failure cases", async function () {
    //     it("Should NOT ALLOW a sweep from a non-sweeper address", async function () {
    //       await expect(
    //         propyKeyRepo.connect(randomAccountSigner).sweepETHByFullBalance(
    //           deployerSigner.address
    //         )
    //       ).to.be.revertedWith("NOT_SWEEPER")
    //     });
    //     it("Should NOT ALLOW a sweep on ETH when balance is zero", async function () {
    //       await expect(
    //         propyKeyRepo.sweepETHByFullBalance(
    //           deployerSigner.address
    //         )
    //       ).to.be.revertedWith("NO_BALANCE")
    //     });
    //     it("Should NOT ALLOW a sweep on ETH when the transfer fails", async function () {
    //       const ForceEther = await ethers.getContractFactory("ForceEther");
    //       let forceEther = await ForceEther.deploy({value: ethers.utils.parseEther("1")});
    //       await forceEther.deployed();
    //       await forceEther.forceTransfer(propyKeyRepo.address);
    //       await expect(
    //         propyKeyRepo.sweepETHByFullBalance(
    //           mockPropyKeysERC721.address
    //         )
    //       ).to.be.revertedWith("ETH_TRANSFER_FAILED")
    //     });
    //   })
    //   context("Success cases", async function () {
    //     it("Should ALLOW an address WITH the SWEEPER role to sweepETHByFullBalance", async function () {
    //       const ForceEther = await ethers.getContractFactory("ForceEther");
    //       let forceEther = await ForceEther.deploy({value: ethers.utils.parseEther("1")});
    //       await forceEther.deployed();
    //       await forceEther.forceTransfer(propyKeyRepo.address);
    //       await expect(
    //         propyKeyRepo.sweepETHByFullBalance(
    //           deployerSigner.address
    //         )
    //       ).to.emit(propyKeyRepo, "ETHSwept");
    //     })
    //   })
    // })
    // context("function sweepOtherNFTById", async function () {
    //   context("Failure cases", async function () {
    //     it("Should NOT ALLOW a sweep from a non-sweeper address", async function () {
    //       await expect(
    //         propyKeyRepo.connect(randomAccountSigner).sweepOtherNFTById(
    //           mockRandomERC721.address,
    //           1,
    //           deployerSigner.address
    //         )
    //       ).to.be.revertedWith("NOT_SWEEPER")
    //     });
    //     it("Should NOT ALLOW a sweep when balance is zero", async function () {
    //       await mockRandomERC721.connect(deployerSigner).mint(deployerSigner.address, "ipfs://");
    //       await expect(
    //         propyKeyRepo.sweepOtherNFTById(
    //           mockRandomERC721.address,
    //           1,
    //           deployerSigner.address
    //         )
    //       ).to.be.revertedWith("ERC721: caller is not token owner or approved")
    //     });
    //     it("Should NOT ALLOW a sweep if it is using the PropyKeys contract address", async function () {
    //       await mockPropyKeysERC721.connect(propyKeyHolderSigner).transferFrom(propyKeyHolderSigner.address, propyKeyRepo.address, 1);
    //       await expect(
    //         propyKeyRepo.sweepOtherNFTById(
    //           mockPropyKeysERC721.address,
    //           1,
    //           deployerSigner.address
    //         )
    //       ).to.be.revertedWith("use sweepPropyKeyById instead")
    //     });
    //   })
    //   context("Success cases", async function () {
    //     it("Should ALLOW an address WITH the SWEEPER role to sweepOtherNFTById", async function () {
    //       await mockRandomERC721.connect(deployerSigner).mint(deployerSigner.address, "ipfs://");
    //       await mockRandomERC721.connect(deployerSigner).transferFrom(deployerSigner.address, propyKeyRepo.address, 1);
    //       await expect(
    //         propyKeyRepo.sweepOtherNFTById(
    //           mockRandomERC721.address,
    //           1,
    //           deployerSigner.address
    //         )
    //       ).to.emit(propyKeyRepo, "OtherNFTSwept");
    //     })
    //   })
    // })
    // context("function setRepossessionConfig", async function () {
    //   context("Failure cases", async function () {
    //     it("Should NOT ALLOW an address WITHOUT the SWEEPER role to sweepPropyKeyById", async function () {
    //       await expect(
    //         propyKeyRepo.connect(randomAccountSigner).sweepPropyKeyById(
    //           1,
    //           deployerSigner.address
    //         )
    //       ).to.be.revertedWith("NOT_SWEEPER")
    //     });
    //   })
    //   context("Success cases", async function () {
    //     it("Should ALLOW an address WITH the SWEEPER role to sweepPropyKeyById", async function () {
    //       await mockPropyKeysERC721.connect(propyKeyHolderSigner).transferFrom(propyKeyHolderSigner.address, propyKeyRepo.address, 1);
    //       await expect(
    //         propyKeyRepo.sweepPropyKeyById(
    //           1,
    //           deployerSigner.address
    //         )
    //       ).to.emit(propyKeyRepo, "PropyKeySwept");
    //     })
    //   })
    // })
    // context("function depositPropyKey", async function () {
    //   context("Failure cases", async function () {
    //     it("Should NOT ALLOW a depositPropyKey on a tokenId which isn't enabled for deposit", async function () {
    //       await expect(
    //         propyKeyRepo.connect(propyKeyHolderSigner).depositPropyKey(
    //           1
    //         )
    //       ).to.be.revertedWith("DEPOSIT_NOT_ENABLED")
    //     });
    //     it("Should NOT ALLOW a depositPropyKey on a tokenId which is enabled for deposit but called by the non-owner of the tokenId", async function () {
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         1,
    //         0
    //       )
    //       await expect(
    //         propyKeyRepo.connect(randomAccountSigner).depositPropyKey(
    //           1
    //         )
    //       ).to.be.revertedWith("ERC721: caller is not token owner or approved")
    //     });
    //   })
    //   context("Success cases", async function () {
    //     it("Should ALLOW a depositPropyKey on a tokenId which is enabled for deposit", async function () {
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         1,
    //         0
    //       )
    //       await mockPropyKeysERC721.connect(propyKeyHolderSigner).approve(propyKeyRepo.address, 1);
    //       await expect(
    //         propyKeyRepo.connect(propyKeyHolderSigner).depositPropyKey(
    //           1
    //         )
    //       ).to.emit(propyKeyRepo, "RepossessionComplete");
    //     })
    //     it("Should ALLOW a depositPropyKey on a tokenId which is enabled for deposit with a PRO reward", async function () {
    //       await propyKeyRepo.setRepossessionConfig(
    //         1,
    //         true,
    //         1,
    //         1
    //       );
    //       await mockPRO.transfer(propyKeyRepo.address, ethers.utils.parseUnits("100", 8));
    //       await mockPropyKeysERC721.connect(propyKeyHolderSigner).approve(propyKeyRepo.address, 1);
    //       await expect(
    //         propyKeyRepo.connect(propyKeyHolderSigner).depositPropyKey(
    //           1
    //         )
    //       ).to.emit(propyKeyRepo, "RepossessionComplete");
    //     })
    //   })
    // })
  })
});
