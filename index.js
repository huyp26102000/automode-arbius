const { default: axios } = require("axios");
const { ethers } = require("ethers");
const EngineABI = require("./V2_EngineV2.json");
const cron = require("node-cron");
require("dotenv").config();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const arbiusContract = new ethers.Contract(
  "0x3BF6050327Fa280Ee1B5F3e8Fd5EA2EfE8A6472a",
  EngineABI,
  provider
);
async function delay(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}
const fetchPrice = async () => {
  const data = {
    submitTask: null,
    claimSolution: null,
    submitSolution: null,
    signalCommitment: null,
  };
  try {
    while (
      !(
        data?.submitTask &&
        data?.claimSolution &&
        data?.submitSolution &&
        data?.signalCommitment
      )
    ) {
      const blockNumber = await provider.getBlockNumber();
      const apiScan = `https://api-nova.arbiscan.io/api?module=account&action=txlist&address=0x3BF6050327Fa280Ee1B5F3e8Fd5EA2EfE8A6472a&startblock=${
        blockNumber - 1000
      }&endblock=${blockNumber}&sort=asc&apikey=QRMANDI8UY4GSF8NT39H6JHXVXNG5EGUUQ`;
      const rs = await axios({
        baseURL: apiScan,
        method: "get",
        headers: {
          "Content-Type": "application/json",
          "cache-control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        },
      });
      const methods = [
        "submitTask",
        "claimSolution",
        "submitSolution",
        "signalCommitment",
      ];
      let gasUsed = 0;
      methods.map((method) => {
        const submiskTask = rs?.data?.result.find(
          (el) => el.functionName.includes(method) && el.isError == "0"
        );
        if (submiskTask?.gasUsed)
          data[method] = ethers.formatEther(
            submiskTask.gasUsed * rs?.data?.result?.[0]?.gasPrice
          );
      });
    }
    return data;
  } catch (error) {
    console.log(error);
  }
};
const fetchReward = async () => {
  try {
    const reward = await arbiusContract.getReward();
    return ethers.formatEther(reward);
  } catch (error) {}
};
async function getEthPrice() {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );

    return response.data.ethereum.usd;
  } catch (error) {
    console.error("Error:", error.message);
  }
}
const processAutomate = async () => {
  try {
    const resp = await axios.get(`${process.env.CORE_URL}/autoclaim`);
    const configf = resp.data;
    console.log(configf);
    if (!configf?.autoclaim?.enable) return;

    const gasFee = await fetchPrice();
    const reward = await fetchReward();
    const realReward = reward * 0.9;
    const ethPrice = await getEthPrice();
    const claimGas = ethPrice * gasFee?.claimSolution;
    console.log("Reward: ", realReward, "gas: ", claimGas);
    // if (
    //   realReward >= +configf.autoclaim.thresshold &&
    //   claimGas <= +configf.autoclaim.limitgas
    // ) {
    //   if (!configf.autoclaim.on) {
    //     console.log("run claim", realReward);
    //     await axios.get(`${process.env.CORE_URL}/autoclaim/switch`);
    //   } else console.log("Already running");
    // } else {
    //   if (configf.autoclaim.on) {
    //     console.log("run stop claim", realReward);
    //     await axios.get(`${process.env.CORE_URL}/autoclaim/switch`);
    //   }
    // }
  } catch (error) {
    console.log(error);
  }
};

const tenSecondlyTask = async () => {
  processAutomate();
};

const cronExpression = "0 */10 * * * *";
cron.schedule(cronExpression, tenSecondlyTask, {
  runOnInit: true,
});
