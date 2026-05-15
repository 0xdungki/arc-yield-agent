require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, RPC_URL } = process.env;

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: "0.8.24",
  networks: {
    arcTestnet: {
      url: RPC_URL || "https://rpc.testnet.arc.network",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 5042002,
    },
    hardhat: {
      chainId: 31337,
    },
  },
  defaultNetwork: "hardhat",
};
