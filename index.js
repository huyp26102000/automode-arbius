const { default: axios } = require("axios");
const { ethers } = require("ethers");
const EngineABI = require("./V2_EngineV2.json");
const cron = require("node-cron");
require("dotenv").config();
const listnode = JSON.parse(process.env.NODE_URL);
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
const fetchNode = async () => {
  try {
    const resp = await axios.get(`${process.env.CORE_URL}/status`);
    return resp.data;
  } catch (error) {
    console.log(error);
  }
};
const processAutomate = async () => {
  try {
    const gasFee = await fetchPrice();
    // const gasFee = {
    //   submitTask: "0.00000345520339",
    //   claimSolution: "0.0000023949633",
    //   submitSolution: "0.00000332364359",
    //   signalCommitment: "0.00000104491963",
    // };
    const reward = await fetchReward();
    const realReward = reward * 0.9;
    const ethPrice = await getEthPrice();
    const claimGas = ethPrice * gasFee?.claimSolution;
    const automineGas =
      ethPrice *
      (+gasFee?.submitTask +
        +gasFee?.claimSolution +
        +gasFee?.submitSolution +
        +gasFee?.signalCommitment);
    console.log("Reward: ", realReward, "gas: ", claimGas);
    const resp = await axios.get(`${process.env.CORE_URL}/auto/status`);
    const configf = resp.data;
    const nodestatus = await fetchNode();
    if (configf?.autoclaim?.enable) {
      if (
        realReward >= +configf.autoclaim.thresshold &&
        claimGas <= +configf.autoclaim.limitgas
      ) {
        if (
          nodestatus.filter((e) => e?.claim == true)?.length !=
          nodestatus?.length
        ) {
          console.log("run claim", realReward);
          // await axios.get(
          //   `${process.env.CORE_URL}/update?action=claim&address=${e}`
          // );
          await Promise.all(
            listnode.map(async (e) => {
              await axios.get(
                `${process.env.CORE_URL}/update?action=claim&address=${e}`
              );
            })
          );
          await axios({
            baseURL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
            url: "/sendMessage",
            method: "post",
            data: {
              chat_id: process.env.TELEGRAM_CHAT_ID,
              text: `@hiro_trk\nAUTO claim Triggered\nReward: <b>${realReward}</b>\nGas <b>${claimGas}</b>`,
              message_thread_id: "24670",
              parse_mode: "html",
              disable_web_page_preview: true,
            },
            headers: {
              "Content-Type": "application/json",
              "cache-control": "no-cache",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } else console.log("Already running");
      } else {
        if (
          nodestatus.filter((e) => e?.claim == false)?.length !=
          nodestatus?.length
        ) {
          console.log("run stop claim", realReward);
          await Promise.all(
            listnode.map(async (e) => {
              await axios.get(
                `${process.env.CORE_URL}/update?action=stopclaim&address=${e}`
              );
            })
          );
          await axios({
            baseURL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
            url: "/sendMessage",
            method: "post",
            data: {
              chat_id: process.env.TELEGRAM_CHAT_ID,
              text: `@hiro_trk\nAUTO stop claim Triggered\nReward: <b>${realReward}</b>\nGas <b>${claimGas}</b>`,
              message_thread_id: "24670",
              parse_mode: "html",
              disable_web_page_preview: true,
            },
            headers: {
              "Content-Type": "application/json",
              "cache-control": "no-cache",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } else {
          console.log("Already stop");
        }
      }
    }
    if (configf?.automine?.enable) {
      if (automineGas <= configf?.automine?.limitgas) {
        if (
          nodestatus.filter((e) => e["start-automine"] == true)?.length !=
          nodestatus?.length
        ) {
          await Promise.all(
            listnode.map(async (e) => {
              await axios.get(
                `${process.env.CORE_URL}/update?action=automine&address=${e}`
              );
            })
          );
          await axios({
            baseURL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
            url: "/sendMessage",
            method: "post",
            data: {
              chat_id: process.env.TELEGRAM_CHAT_ID,
              text: `@hiro_trk\nAUTO automine Triggered\nGas: <b>${automineGas}</b>\nLimit <b>${configf?.automine?.limitgas}</b>`,
              message_thread_id: "24670",
              parse_mode: "html",
              disable_web_page_preview: true,
            },
            headers: {
              "Content-Type": "application/json",
              "cache-control": "no-cache",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } else console.log("Already automine");
      } else {
        if (
          nodestatus.filter((e) => e["start-automine"] == false)?.length !=
          nodestatus?.length
        ) {
          await Promise.all(
            listnode.map(async (e) => {
              await axios.get(
                `${process.env.CORE_URL}/update?action=stopall&address=${e}`
              );
            })
          );
          await axios({
            baseURL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
            url: "/sendMessage",
            method: "post",
            data: {
              chat_id: process.env.TELEGRAM_CHAT_ID,
              text: `@hiro_trk\nAUTO stop automine Triggered\nGas: <b>${automineGas}</b>\nLimit <b>${configf?.automine?.limitgas}</b>`,
              message_thread_id: "24670",
              parse_mode: "html",
              disable_web_page_preview: true,
            },
            headers: {
              "Content-Type": "application/json",
              "cache-control": "no-cache",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } else console.log("Already stop automine");
      }
    }
  } catch (error) {
    console.log(error);
  }
};

(async () => {
  while (true) {
    await processAutomate();
    await delay(60000);
  }
})();
