const { Wallet, ethers } = require("ethers");
const maxBlocks = 10_000;

const scanTask = async (arbius, targetAddress, startBlock, endBlock) => {
  const unclaimedTasks = [];

  let fromBlock = startBlock;
  let toBlock =
    endBlock - fromBlock + 1 > maxBlocks ? fromBlock + maxBlocks - 1 : endBlock;

  while (toBlock <= endBlock) {
    console.log(
      `Processing block [${fromBlock.toString()} to ${toBlock.toString()}]`
    );
    const events = await arbius.provider.getLogs({
      address: arbius.address,
      topics: [
        [
          arbius.interface.getEventTopic("SolutionSubmitted"),
          arbius.interface.getEventTopic("SolutionClaimed"),
        ],
        ethers.utils.hexZeroPad(targetAddress, 32),
      ],
      fromBlock,
      toBlock,
    });
    events.map((event) => {
      const parsedLog = arbius.interface.parseLog(event);
      switch (parsedLog.name) {
        case "SolutionSubmitted":
          //   console.log(`Found solution submitted: ${parsedLog.args.task}`);
          unclaimedTasks.push(parsedLog.args.task);
          break;
        case "SolutionClaimed":
          //   console.log(`Found solution claimed: ${parsedLog.args.task}`);
          const unclaimedTaskIdx = unclaimedTasks.indexOf(parsedLog.args.task);
          if (unclaimedTaskIdx > -1) {
            unclaimedTasks.splice(unclaimedTaskIdx, 1);
          }
          break;
      }
    });

    console.log(`Unclaimed solutions: ${unclaimedTasks.length}`);

    if (toBlock === endBlock) break;
    fromBlock = toBlock + 1;
    toBlock =
      endBlock - fromBlock + 1 > maxBlocks
        ? fromBlock + maxBlocks - 1
        : endBlock;
  }

  return unclaimedTasks.length;
};
const fetchUnclaim = async (arbius, wallet) => {
  const currentBlock = +(await wallet.provider.getBlockNumber());
  let lastScanBlock = +currentBlock - 1000000;
  const unclaimData = await Promise.all(
    ["0xDDfb3eE2E3801fb53BB0Df20E2A8bFdda0186858"].map(async (adr) => {
      return await scanTask(arbius, adr, lastScanBlock, currentBlock);
    })
  );
  return unclaimData;
};

module.exports = { fetchUnclaim };
