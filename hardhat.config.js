require("@nomiclabs/hardhat-waffle");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("solidity-coverage");
require("dotenv").config();
const { merkleTreeGenerator } = require('./utils');
const fs = require('fs');
const path = require('path');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("merkleGen", "Generates the merkle tree and returns the merkle root for the relevant set of data")
  .addParam("merkleData", "The file path for the merkle data")
  .setAction(async (taskArgs) => {
    console.log(`Generating merkle tree and returning merkle root for file: merkle-data/${taskArgs.merkleData}`)
    const rawData = await fs.readFileSync(path.join(__dirname, `merkle-data/${taskArgs.merkleData}`), 'utf8');
    if(rawData) {
      let parsedData = JSON.parse(rawData);
      let merkleRoot = await merkleTreeGenerator(parsedData);
      console.log({merkleRoot});
    } else {
      console.log(`File not found`)
    }
  });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.11",
      },
      {
        version: "0.8.4",
      },
      {
        version: "0.5.11",
      },
      {
        version: "0.4.18",
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: {
        count: 20, // Adjust the number of accounts available when using the local Hardhat network
      }
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: [`${process.env.DEPLOYMENT_ADDRESS_PRIVATE_KEY}`]
    },
    sepolia: {
      url: `https://wandering-light-lambo.ethereum-sepolia.quiknode.pro/${process.env.SEPOLIA_QUICKNODE_KEY}/`,
      accounts: [`${process.env.DEPLOYMENT_ADDRESS_PRIVATE_KEY}`]
    },
    baseSepolia: {
      url: `https://bold-ancient-card.base-sepolia.quiknode.pro/${process.env.BASE_SEPOLIA_QUICKNODE_KEY}/`,
      accounts: [`${process.env.DEPLOYMENT_ADDRESS_PRIVATE_KEY}`],
      gasPrice: 50000
    },
    base: {
      url: `https://black-stylish-film.base-mainnet.quiknode.pro/${process.env.BASE_QUICKNODE_KEY}/`,
      accounts: [`${process.env.DEPLOYMENT_ADDRESS_PRIVATE_KEY}`],
    },
    mainnet: {
      url: `https://fittest-cosmological-grass.quiknode.pro/${process.env.MAINNET_QUICKNODE_KEY}/`,
      accounts: [`${process.env.DEPLOYMENT_ADDRESS_PRIVATE_KEY}`]
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "base",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org/",
        },
      }
    ]
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 20,
    coinmarketcap: process.env.COIN_MARKET_CAP_API_KEY
  }
};