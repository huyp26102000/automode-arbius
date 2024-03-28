const { default: axios } = require("axios");
const { readFile, writeFile, readFileSync, writeFileSync } = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const { fetchUnclaim } = require("./utils/unclaim");
const { Wallet, ethers, Contract } = require("ethers");
const EngineABI = require("./contracts/V2_EngineV2.json");
const { OFFER_JSON_URL } = require("./constants");
require("dotenv").config();
const listNode = JSON.parse(process.env.NODE_URL);

const bot = new TelegramBot("6723022602:AAFIxxvopAaEq5d2cNcX0d5zKprbz31BnAI", {
  polling: true,
});
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new Wallet(process.env.SCRAPT_WALLET, provider);
const arbius = new Contract(
  "0x3BF6050327Fa280Ee1B5F3e8Fd5EA2EfE8A6472a",
  EngineABI,
  wallet
);
let offers = [];
(async () => {
  try {
    const rawOffers = readFileSync(OFFER_JSON_URL, "utf-8");
    offers = JSON.parse(rawOffers);
  } catch (error) {
    console.log(error);
    writeFileSync(OFFER_JSON_URL, "[]");
  }
})();

const CORE_URL = `https://miner-manager-tg0l.onrender.com`;
let actions = [];
const addAction = async (msg) => {
  try {
    const fromID = msg?.from?.id;
    actions = [
      ...actions.filter((e) => e?.from != fromID),
      {
        from: fromID,
        action: msg?.text,
      },
    ];
    await bot.sendMessage(
      msg.chat.id,
      `Which node:
Huy: 
/${listNode[0]}
/${listNode[1]}
Thien: 
/${listNode[2]}
/${listNode[3]}`
    );
  } catch (error) {
    console.log("error add action");
  }
};
const addressShortener = (addr = "", digits = 5) => {
  digits = 2 * digits >= addr.length ? addr.length : digits;
  return `${addr.substring(0, digits)}...${addr.slice(-digits)}`;
};

function updateAutoclaimEnable() {
  readFile(path, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading the file:", err);
      return;
    }

    try {
      const config = JSON.parse(data);
      config.autoclaim.enable = !config.autoclaim.enable;
      const updatedConfig = JSON.stringify(config, null, 2);

      writeFile(path, updatedConfig, "utf8", (err) => {
        if (err) {
          console.error("Error writing to the file:", err);
        } else {
          console.log("Enable value updated successfully!");
        }
      });
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
    }
  });
}
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  console.log(msg);
  const getStatus = async () => {
    const resp = await axios.get(`${CORE_URL}/status`);
    const data = resp?.data;
    console.log(data);
    await bot.sendMessage(
      chatId,
      `${data
        .map(
          (e, index) => `<b>${addressShortener(e?.address)}</b> <b>[${
            e?.start
              ? "Mining"
              : e?.["start-automine"]
              ? "Automine"
              : "Not running"
          }]</b>
Claim: <b>${e?.claim}</b>
\n`
        )
        .join("")}`,
      {
        parse_mode: "HTML",
      }
    );
  };
  const getConfig = async () => {
    try {
      const resp = await axios.get(`${CORE_URL}/auto/status`);
      const data = resp?.data;
      await bot.sendMessage(
        chatId,
        `Auto Claim: <code>${
          data?.autoclaim?.enable ? "ON" : "OFF"
        }</code> [<code>${data?.autoclaim?.thresshold}</code>]
Gas: <code>${data?.autoclaim?.limitgas}</code>
Automine: <code>${data?.automine?.enable ? "ON" : "OFF"}</code>
Gas: <code>${data?.automine?.limitgas}</code>`,
        {
          parse_mode: "HTML",
        }
      );
    } catch (error) {
      console.log("CONFIG", error);
    }
  };
  const params = msg?.text.split(" ");
  const supportedMethod = ["claim", "automine"];
  const supportedParams = ["gas", "thresshold"];
  switch (params[0]) {
    case "/order":
      (async () => {
        if (params?.length == 5) {
          await queueOffer(params[1], params[2], params[3], params[4]);
        }
      })();
      break;
    case "/help":
      bot.sendMessage(
        chatId,
        `<code></code>
<code>/config claim thresshold 0.0010</code>
<code>/config claim gas 0.012</code>
<code>/config automine off</code>
<code>/config claim on</code>
<code>/config claim off</code>
<code>/unclaim 0xDDfb3eE2E3801fb53BB0Df20E2A8bFdda0186858</code>
/config
/status
/mine
/automine
/stopall
/claim
/stopclaim
/config`,
        {
          parse_mode: "HTML",
        }
      );
      break;
    case "/unclaim":
      (async () => {
        await bot.sendMessage(chatId, "Loading...");
        const data = await fetchUnclaim(arbius, wallet, params[1]);
        bot.sendMessage(
          chatId,
          `Unclaim Task
${addressShortener(params[1])} ${data}`
        );
      })();
      break;
    case "/config":
      (async () => {
        switch (params?.length) {
          case 1:
            getConfig();
            break;
          case 3:
            if (supportedMethod.includes(params[1])) {
              if (params[2] == "on") {
                await axios.get(`${CORE_URL}/auto/${params[1]}/enable`);
              } else if (params[2] == "off") {
                await axios.get(`${CORE_URL}/auto/${params[1]}/disable`);
              }
              await getConfig();
            }
            break;
          case 4:
            if (
              supportedMethod.includes(params[1]) &&
              supportedParams.includes(params[2])
            ) {
              await axios.get(
                `${CORE_URL}/auto/${params[1]}/${params[2]}?value=${params[3]}`
              );
              await getConfig();
            }
            break;
          default:
            bot.sendMessage(chatId, `Invalid command`, {
              parse_mode: "HTML",
            });
            break;
        }
      })();
      break;
    case "/status":
      (async () => {
        await bot.sendMessage(chatId, "Loading...");
        await getStatus();
      })();
      break;
    case "/claim":
      addAction(msg);
      break;
    case "/stopclaim":
      addAction(msg);
      break;
    case "/mine":
      addAction(msg);
      break;
    case "/automine":
      addAction(msg);
      break;
    case "/stopall":
      addAction(msg);
      break;
    case "/auto":
      break;
    case "/stopautoclaim":
      break;
    default:
      const selectedNode = msg?.text?.replace("/", "");
      const findAction = actions.find((e) => e?.from == msg?.from?.id);
      console.log(findAction);
      if (selectedNode && findAction) {
        try {
          (async () => {
            await bot.sendMessage(chatId, "Loading...");
            console.log(selectedNode, findAction);
            const url = `${CORE_URL}/update?address=${selectedNode}&action=${findAction?.action?.replace(
              "/",
              ""
            )}`;
            console.log(url);
            await axios.get(url);
            await getStatus();
          })();
        } catch (error) {
          bot.sendMessage(chatId, "Action fail!");
        }
      }
      break;
  }
});
