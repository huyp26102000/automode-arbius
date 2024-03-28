require("dotenv").config();
const swapABI = require("../contracts/swapABI.json");
const { default: axios } = require("axios");
console.log(JSON.parse(process.env.SELL_WALLET));
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

const getAiusNovaPrice = async () => {
  const rs = await axios({
    baseURL: `https://api.dexscreener.com/`,
    url: "/latest/dex/pairs/arbitrumnova/0x9b614cb49880aee59537fd21d106aed03171438f",
    method: "get",
    headers: {
      "Content-Type": "application/json",
      "cache-control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
  console.log(rs?.data?.pair.priceUsd, "price");
  // if (rs?.data?.pair.priceUsd > targetPrice) {
  //     const amount = ethers.utils.parseUnits(amountAIUS.toString(), 'ether')
  //     await sellAius(listPrivateKey[0], amount)
  // }
};
const sellAius = async (privateKey, amount) => {
  const wallet = new ethers.Wallet(privateKey, provider);

  const ContractPCS = new ethers.Contract(
    "0xcdbcd51a5e8728e0af4895ce5771b7d17ff71959",
    swapABI,
    provider
  );
  const nonce = await wallet.getTransactionCount();
  console.log(wallet.address);
  const ctwithWal = ContractPCS.connect(wallet);
  const tx2 = await ctwithWal.processRoute(
    "0x8AFE4055Ebc86Bd2AFB3940c0095C9aca511d852",
    amount,
    "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    0,
    wallet.address,
    `0x028afe4055ebc86bd2afb3940c0095c9aca511d85201ffff019b614cb49880aee59537fd21d106aed03171438f00cdbcd51a5e8728e0af4895ce5771b7d17ff7195901722e8bdd2ce80a4422e880164f2079488e11536501ffff0200${wallet.address.slice(
      2
    )}`
  );

  console.log(tx2, "tx2tx2");
  process.exit(1);
};

const queueOffer = async (address, amount, price, chain) => {
  try {
    console.log("demo");
  } catch (error) {
    console.log(error);
  }
};
module.exports = { queueOffer };
