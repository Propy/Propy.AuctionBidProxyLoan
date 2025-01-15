// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

const etherscanChainIds = [
  1, // Mainnet
  3, // Ropsten
  4, // Rinkeby
  5, // Goerli
  11155111, // Sepolia
  'base',
  'baseSepolia',
  'sepolia',
  'goerli',
  'homestead',
  'mainnet',
]

const networkNameToWhitelistAddress = {
  "sepolia": "0xB7b0504C043533d0dbcB952AC3f9c4450e10d5a0",
  "mainnet": "0xBE2779646C64e0f7111F4Dd32f3a6940B4717629",
}

async function main() {

  let [deployerSigner] = await hre.ethers.getSigners();

  const ADMIN_ROLE = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775";
  const MAINTAINER_ROLE = "0x339759585899103d2ace64958e37e18ccb0504652c81d4a1b8aa80fe2126ab95";

  console.log(`Deploying from: ${deployerSigner.address}, hre.network: ${hre.network.name}`);

  let deployerAddress = deployerSigner.address;
  // let mockPRO;
  let adminAddress;
  let maintainerAddress;
  let whitelistContractAddress;
  if(hre.network.name === "mainnet") {
    // adminAddress = deployerSigner.address;
    adminAddress = "0x28C280f7eAB602F00aC329E6091e5713A599b3f6";
    maintainerAddress = "0x28C280f7eAB602F00aC329E6091e5713A599b3f6";
  } else if(hre.network.name === "base") {
    // adminAddress = deployerSigner.address;
  } else if (["goerli", "sepolia", "hardhat", "baseSepolia"].indexOf(hre.network.name) > -1) {
    // testnet config
    adminAddress = "0x3426803C91c2e7892eB345Ac4769966196CD100B";
    maintainerAddress = "0x3426803C91c2e7892eB345Ac4769966196CD100B";
  }
  if(networkNameToWhitelistAddress[hre.network.name]) {
    whitelistContractAddress = networkNameToWhitelistAddress[hre.network.name];
  }

  if(adminAddress && maintainerAddress && whitelistContractAddress) {

    const ClonableAuctionBidProxyLoan = await ethers.getContractFactory("ClonableAuctionBidProxyLoan");
    const clonableAuctionBidProxyLoan = await ClonableAuctionBidProxyLoan.deploy();
    await clonableAuctionBidProxyLoan.deployed();

    const ClonableMerkleProofMinimal = await ethers.getContractFactory("ClonableMerkleProofMinimal");
    const clonableMerkleProofMinimal = await ClonableMerkleProofMinimal.deploy();
    await clonableMerkleProofMinimal.deployed();

    const BidProxyFactory = await ethers.getContractFactory("BidProxyFactory");
    const bidProxyFactory = await BidProxyFactory.deploy(
      clonableAuctionBidProxyLoan.address,
      clonableMerkleProofMinimal.address,
      whitelistContractAddress
    );
    await bidProxyFactory.deployed();

    console.log("ClonableAuctionBidProxyLoan contract deployed to:", clonableAuctionBidProxyLoan.address);
    console.log("ClonableMerkleProofMinimal contract deployed to:", clonableMerkleProofMinimal.address);
    console.log("BidProxyFactory contract deployed to:", bidProxyFactory.address);

    // transfer ownership of factory to adminAddress
    await bidProxyFactory.transferOwnership(adminAddress);
    console.log("BidProxyFactory ownership transferred to:", adminAddress);

    // We run verification on Etherscan
    // If there is an official Etherscan instance of this network we are deploying to
    if(etherscanChainIds.indexOf(hre.network.name) > -1) {
      console.log('Deploying to a network supported by Etherscan, running Etherscan contract verification')
      
      // First we pause for a minute to give Etherscan a chance to update with our newly deployed contracts
      console.log('First waiting a minute to give Etherscan a chance to update...')
      await new Promise((resolve) => setTimeout(resolve, 60000));

      // We can now run Etherscan verification of our contracts
      try {
        await hre.run('verify:verify', {
          address: clonableMerkleProofMinimal.address,
          constructorArguments: []
        });
      } catch (err) {
        console.log(`Verification error for reference contract: ${err}`);
      }

      try {
        await hre.run('verify:verify', {
          address: clonableMerkleProofMinimal.address,
          constructorArguments: []
        });
      } catch (err) {
        console.log(`Verification error for reference contract: ${err}`);
      }

      try {
        await hre.run('verify:verify', {
          address: bidProxyFactory.address,
          constructorArguments: [
            clonableAuctionBidProxyLoan.address,
            clonableMerkleProofMinimal.address,
            whitelistContractAddress
          ]
        });
      } catch (err) {
        console.log(`Verification error for reference contract: ${err}`);
      }

    } else {
      console.log('Not deploying to a network supported by Etherscan, skipping Etherscan contract verification');
    }

  } else {
    console.error("ERROR: adminAddress required");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
