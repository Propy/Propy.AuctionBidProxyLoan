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

  let deployerSigner, sellerSigner, adminSigner, maintainerSigner, standardBidder1Signer, standardBidder2Signer, proxyBidder1Signer, proxyBidder2Signer, bidder3SignerNoWhitelist, recoveredFundsAddress;

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
  let increasedBidBeyondInitialLimit = ethers.utils.parseUnits("100", 18).toString();
  let minBidERC20 = ethers.utils.parseUnits("5", 8).toString();
  let increasedBidERC20 = ethers.utils.parseUnits("10", 8).toString();
  let increasedBidERC20BeyondInitialLimit = ethers.utils.parseUnits("100", 8).toString();

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
      recoveredFundsAddress,
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
        it("Should allow a whitelisted address to increase their existing bid on an auction after having their allowance increased via merkle (updateMerkleProofContract)", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerETH[proxyBidder1Signer.address]} ETH`);
          let merkleProof = await merkleTreeGenerateProof(loanPowerETH, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address]);
          console.log({merkleProof});
          await expect(
            bidProxyETH.connect(proxyBidder1Signer).proxyBid(merkleProof, proxyBidder1Signer.address, loanPowerETH[proxyBidder1Signer.address], minBidEth)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          let merkleProofBidder2 = await merkleTreeGenerateProof(loanPowerETH, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address]);
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofBidder2, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address], increasedBid)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofBidder2, proxyBidder2Signer.address, loanPowerETH[proxyBidder2Signer.address], increasedBidBeyondInitialLimit)
          ).to.be.revertedWith("INSUFFICIENT_LOAN_ALLOWANCE");
          let increasedLoanPowerETH = {};
          increasedLoanPowerETH[proxyBidder1Signer.address] = increasedBidBeyondInitialLimit;
          increasedLoanPowerETH[proxyBidder2Signer.address] = increasedBidBeyondInitialLimit;
          increasedLoanPowerETH[bidder3SignerNoWhitelist.address] = increasedBidBeyondInitialLimit;
          let increasedMerkleRootETH = await merkleTreeGenerator(increasedLoanPowerETH);
          let txNewMerkleProofClone = await bidProxyFactory.newMerkleProofClone(increasedMerkleRootETH);
          let	txWithNewEventResponse = await txNewMerkleProofClone.wait();
          let event = txWithNewEventResponse.events.find((item) => item.event === 'NewMerkleRootClone');
          let newMerkleProofCloneAddress = event?.args?.merkleRootClone;
          await expect(
            bidProxyETH.connect(maintainerSigner).updateMerkleProofContract(newMerkleProofCloneAddress)
          ).to.emit(bidProxyETH, "UpdatedMerkleProofContract");
          let merkleProofBidder2IncreasedBid = await merkleTreeGenerateProof(increasedLoanPowerETH, proxyBidder2Signer.address, increasedLoanPowerETH[proxyBidder2Signer.address]);
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofBidder2IncreasedBid, proxyBidder2Signer.address, increasedLoanPowerETH[proxyBidder2Signer.address], increasedBidBeyondInitialLimit)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
        });
        it("Should allow a whitelisted address to increase their existing bid on an auction after having their allowance increased via merkle (updateFullConfig)", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          let increasedLoanPowerETH = {};
          increasedLoanPowerETH[proxyBidder1Signer.address] = increasedBidBeyondInitialLimit;
          increasedLoanPowerETH[proxyBidder2Signer.address] = increasedBidBeyondInitialLimit;
          increasedLoanPowerETH[bidder3SignerNoWhitelist.address] = increasedBidBeyondInitialLimit;
          let increasedMerkleRootETH = await merkleTreeGenerator(increasedLoanPowerETH);
          let txNewMerkleProofClone = await bidProxyFactory.newMerkleProofClone(increasedMerkleRootETH);
          let	txWithNewEventResponse = await txNewMerkleProofClone.wait();
          let event = txWithNewEventResponse.events.find((item) => item.event === 'NewMerkleRootClone');
          let newMerkleProofCloneAddress = event?.args?.merkleRootClone;
          let merkleProofBidder2IncreasedBid = await merkleTreeGenerateProof(increasedLoanPowerETH, proxyBidder2Signer.address, increasedLoanPowerETH[proxyBidder2Signer.address]);
          await expect(
            bidProxyETH.connect(maintainerSigner).updateFullConfig(
              newMerkleProofCloneAddress,
              mockWhitelist.address,
              zeroAddress,
              propyAuctionV2.address,
              mockRWA.address,
              ethAuctionNftId,
              auctionStartTime,
            )
          ).to.emit(bidProxyETH, "UpdatedAuctionConfig");
          await expect(
            bidProxyETH.connect(proxyBidder2Signer).proxyBid(merkleProofBidder2IncreasedBid, proxyBidder2Signer.address, increasedLoanPowerETH[proxyBidder2Signer.address], increasedBidBeyondInitialLimit)
          ).to.emit(bidProxyETH, "SuccessfulProxyBidETH");
          await expect(
            bidProxyETH.connect(maintainerSigner).updateFullConfig(
              newMerkleProofCloneAddress,
              mockWhitelist.address,
              zeroAddress,
              propyAuctionV2ERC20.address,
              mockRWA.address,
              erc20AuctionNftId,
              auctionStartTime,
            )
          ).to.be.revertedWith("ALREADY_IN_PROGRESS")
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
        it("Should allow the bidProxy contract to withdraw ETH from the auction contract when a normal bidder wins", async function () {
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
          await expect(
            propyAuctionV2.connect(standardBidder2Signer).bid(mockRWA.address, ethAuctionNftId, auctionStartTime, {value: BigNumber(increasedBid).plus(300).toString()})
          ).to.emit(propyAuctionV2, "Bid");
          await time.setNextBlockTimestamp(auctionEndTime + 1);
          // function finalize(
          //   IERC721 _nft,
          //   uint _nftId,
          //   uint32 _start,
          //   address _winner,
          //   address[] memory _payoutAddresses,
          //   uint256[] memory _payoutAddressValues
          // ) external onlyRole(FINALIZE_ROLE) {
          let winningBid = await propyAuctionV2.getBid(mockRWA.address, ethAuctionNftId, auctionStartTime, standardBidder2Signer.address);
          await expect(
            propyAuctionV2.finalize(mockRWA.address, ethAuctionNftId, auctionStartTime, standardBidder2Signer.address, [sellerSigner.address], [winningBid.toString()])
          ).to.emit(propyAuctionV2, "Finalized");
          let currentOwner = await mockRWA.ownerOf(ethAuctionNftId);
          await expect(currentOwner).to.equal(standardBidder2Signer.address);
          // Ensure that BidProxy can withdraw funds from auction contract
          let proxyBidAmount = await propyAuctionV2.getBid(mockRWA.address, ethAuctionNftId, auctionStartTime, bidProxyETH.address);
          let bidProxyBalanceBeforeClaim = await bidProxyETH.provider.getBalance(bidProxyETH.address);
          await expect(
            bidProxyETH.connect(maintainerSigner).claimAndWithdrawBidFromAuction()
          ).to.emit(bidProxyETH, "ETHBidClaimedAndWithdrawnFromAuction");
          let bidProxyBalanceAfterClaim = await bidProxyETH.provider.getBalance(bidProxyETH.address);
          await expect(bidProxyBalanceAfterClaim.toString()).to.equal(bidProxyBalanceBeforeClaim.add(proxyBidAmount).toString());
          // Ensure that maintainer can recover the ETH from the bidProxy contract
          let recoverFundsAddressBeforeRecovery = await bidProxyETH.provider.getBalance(recoveredFundsAddress.address);
          await expect(
            bidProxyETH.connect(maintainerSigner).recoverETH(recoveredFundsAddress.address, bidProxyBalanceAfterClaim)
          ).to.emit(bidProxyETH, "ETHRecovered");
          let recoverFundsAddressAfterRecovery = await bidProxyETH.provider.getBalance(recoveredFundsAddress.address);
          await expect(recoverFundsAddressAfterRecovery.toString()).to.equal(recoverFundsAddressBeforeRecovery.add(bidProxyBalanceAfterClaim).toString());
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
        it("Should allow a whitelisted address to increase their existing bid on an auction after having their allowance increased via merkle", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          console.log(`Generating merkle proof for ${proxyBidder1Signer.address} to bid with up to ${loanPowerERC20[proxyBidder1Signer.address]} ERC20`);
          let merkleProof = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address]);
          await expect(
            bidProxyERC20.connect(proxyBidder1Signer).proxyBid(merkleProof, proxyBidder1Signer.address, loanPowerERC20[proxyBidder1Signer.address], minBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          let merkleProofBidder2 = await merkleTreeGenerateProof(loanPowerERC20, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address]);
          await expect(
            bidProxyERC20.connect(proxyBidder2Signer).proxyBid(merkleProofBidder2, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address], increasedBidERC20)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          await expect(
            bidProxyERC20.connect(proxyBidder2Signer).proxyBid(merkleProofBidder2, proxyBidder2Signer.address, loanPowerERC20[proxyBidder2Signer.address], increasedBidERC20BeyondInitialLimit)
          ).to.be.revertedWith("INSUFFICIENT_LOAN_ALLOWANCE");
          let increasedLoanPowerERC20 = {};
          increasedLoanPowerERC20[proxyBidder1Signer.address] = increasedBidERC20BeyondInitialLimit;
          increasedLoanPowerERC20[proxyBidder2Signer.address] = increasedBidERC20BeyondInitialLimit;
          increasedLoanPowerERC20[bidder3SignerNoWhitelist.address] = increasedBidERC20BeyondInitialLimit;
          let increasedMerkleRootERC20 = await merkleTreeGenerator(increasedLoanPowerERC20);
          let txNewMerkleProofClone = await bidProxyFactory.newMerkleProofClone(increasedMerkleRootERC20);
          let	txWithNewEventResponse = await txNewMerkleProofClone.wait();
          let event = txWithNewEventResponse.events.find((item) => item.event === 'NewMerkleRootClone');
          let newMerkleProofCloneAddress = event?.args?.merkleRootClone;
          await expect(
            bidProxyERC20.connect(maintainerSigner).updateMerkleProofContract(newMerkleProofCloneAddress)
          ).to.emit(bidProxyERC20, "UpdatedMerkleProofContract");
          let merkleProofBidder2IncreasedBid = await merkleTreeGenerateProof(increasedLoanPowerERC20, proxyBidder2Signer.address, increasedLoanPowerERC20[proxyBidder2Signer.address]);
          await expect(
            bidProxyERC20.connect(proxyBidder2Signer).proxyBid(merkleProofBidder2IncreasedBid, proxyBidder2Signer.address, increasedLoanPowerERC20[proxyBidder2Signer.address], increasedBidERC20BeyondInitialLimit)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
        });
        it("Should allow a whitelisted address to increase their existing bid on an auction after having their allowance increased via merkle (updateFullConfig)", async function () {
          await time.setNextBlockTimestamp(auctionStartTime + 1);
          let increasedLoanPowerERC20 = {};
          increasedLoanPowerERC20[proxyBidder1Signer.address] = increasedBidERC20BeyondInitialLimit;
          increasedLoanPowerERC20[proxyBidder2Signer.address] = increasedBidERC20BeyondInitialLimit;
          increasedLoanPowerERC20[bidder3SignerNoWhitelist.address] = increasedBidERC20BeyondInitialLimit;
          let increasedMerkleRootERC20 = await merkleTreeGenerator(increasedLoanPowerERC20);
          let txNewMerkleProofClone = await bidProxyFactory.newMerkleProofClone(increasedMerkleRootERC20);
          let	txWithNewEventResponse = await txNewMerkleProofClone.wait();
          let event = txWithNewEventResponse.events.find((item) => item.event === 'NewMerkleRootClone');
          let newMerkleProofCloneAddress = event?.args?.merkleRootClone;
          let merkleProofBidder2IncreasedBid = await merkleTreeGenerateProof(increasedLoanPowerERC20, proxyBidder2Signer.address, increasedLoanPowerERC20[proxyBidder2Signer.address]);
          await expect(
            bidProxyERC20.connect(maintainerSigner).updateFullConfig(
              newMerkleProofCloneAddress,
              mockWhitelist.address,
              mockPRO.address,
              propyAuctionV2ERC20.address,
              mockRWA.address,
              erc20AuctionNftId,
              auctionStartTime,
            )
          ).to.emit(bidProxyERC20, "UpdatedAuctionConfig");
          await expect(
            bidProxyERC20.connect(proxyBidder2Signer).proxyBid(merkleProofBidder2IncreasedBid, proxyBidder2Signer.address, increasedLoanPowerERC20[proxyBidder2Signer.address], increasedBidERC20BeyondInitialLimit)
          ).to.emit(bidProxyERC20, "SuccessfulProxyBidERC20");
          await expect(
            bidProxyERC20.connect(maintainerSigner).updateFullConfig(
              newMerkleProofCloneAddress,
              mockWhitelist.address,
              mockPRO.address,
              propyAuctionV2ERC20.address,
              mockRWA.address,
              erc20AuctionNftId,
              auctionStartTime,
            )
          ).to.be.revertedWith("ALREADY_IN_PROGRESS")
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
        it("Should allow the bidProxy contract to withdraw ERC20 token from the auction contract when a normal bidder wins", async function () {
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
          await mockPRO.connect(standardBidder2Signer).approve(propyAuctionV2ERC20.address, BigNumber(increasedBidERC20).plus(300).toString());
          await expect(
            propyAuctionV2ERC20.connect(standardBidder2Signer).bidToken(mockRWA.address, erc20AuctionNftId, auctionStartTime, BigNumber(increasedBidERC20).plus(300).toString())
          ).to.emit(propyAuctionV2ERC20, "Bid");
          await time.setNextBlockTimestamp(auctionEndTime + 1);
          // function finalize(
          //   IERC721 _nft,
          //   uint _nftId,
          //   uint32 _start,
          //   address _winner,
          //   address[] memory _payoutAddresses,
          //   uint256[] memory _payoutAddressValues
          // ) external onlyRole(FINALIZE_ROLE) {
          let winningBid = await propyAuctionV2ERC20.getBid(mockRWA.address, erc20AuctionNftId, auctionStartTime, standardBidder2Signer.address);
          console.log({winningBid, 'BigNumber(increasedBidERC20).plus(200).toString()': BigNumber(increasedBidERC20).plus(200).toString()});
          await expect(
            propyAuctionV2ERC20.finalize(mockRWA.address, erc20AuctionNftId, auctionStartTime, standardBidder2Signer.address, [sellerSigner.address], [winningBid])
          ).to.emit(propyAuctionV2ERC20, "Finalized");
          let currentOwner = await mockRWA.ownerOf(erc20AuctionNftId);
          await expect(currentOwner).to.equal(standardBidder2Signer.address);
          // Ensure that BidProxy can withdraw funds from auction contract
          let proxyBidAmount = await propyAuctionV2ERC20.getBid(mockRWA.address, erc20AuctionNftId, auctionStartTime, bidProxyERC20.address);
          let bidProxyBalanceBeforeClaim = await mockPRO.balanceOf(bidProxyERC20.address);
          await expect(
            bidProxyERC20.connect(maintainerSigner).claimAndWithdrawBidFromAuction()
          ).to.emit(bidProxyERC20, "ERC20BidClaimedAndWithdrawnFromAuction");
          let bidProxyBalanceAfterClaim = await mockPRO.balanceOf(bidProxyERC20.address);
          await expect(bidProxyBalanceAfterClaim.toString()).to.equal(bidProxyBalanceBeforeClaim.add(proxyBidAmount).toString());
          // Ensure that maintainer can recover the ETH from the bidProxy contract
          let recoverFundsAddressBeforeRecovery = await mockPRO.balanceOf(recoveredFundsAddress.address);
          await expect(
            bidProxyERC20.connect(maintainerSigner).recoverTokens(mockPRO.address, recoveredFundsAddress.address, bidProxyBalanceAfterClaim)
          ).to.emit(bidProxyERC20, "TokensRecovered");
          let recoverFundsAddressAfterRecovery = await mockPRO.balanceOf(recoveredFundsAddress.address);
          await expect(recoverFundsAddressAfterRecovery.toString()).to.equal(recoverFundsAddressBeforeRecovery.add(bidProxyBalanceAfterClaim).toString());
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
  })
});
