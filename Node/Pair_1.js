const fs = require("fs");
const express = require("express");
const app = express();
const BP = require("body-parser");
app.use(BP.json());
const axios = require("axios");
const cors = require("cors");
const BigNumber = require("bignumber.js");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use(cors("*"));

const polygon_pairs = fs.readFileSync("PolygonPairs.json", "utf8");

function divideArray(array, chunkSize, index) {
  var dividedArrays = [];
  let len = Math.round(array.length / chunkSize);
  let qwer = index * len;
  //console.log(len, qwer);
  for (let i = index; i <= len; i++) {
    dividedArrays.push(array[i]);
  }
  return dividedArrays;
}

async function GenerateAIpairs1(data) {
  // console.log("data", data);
  console.log("Calling 1");

  try {
    const amount = data.amount;
    let network;
    let pairs;
    //console.log(data.Network);
    if (data.Network === "Polygon") {
      pairs = JSON.parse(polygon_pairs);
      network = 137;
    } else if (data.Network === "Optimism") {
      pairs = JSON.parse(optimism_pairs);
      network = 10;
    }

    const filterValue = data.symbol;

    const filteredPairs = pairs.filter((pair) => pair.from === filterValue);
    let index = 1;
    var originalArray = filteredPairs;
    var dividedArrays = divideArray(originalArray, 5, index);
    let newArray = [];
    await Promise.all(
      dividedArrays.map(async (pair, index) => {
        const delayTime = 300;

        await new Promise((resolve) => setTimeout(resolve, delayTime));

        const openOceanData = await generateAIopenOcean(pair, amount, network);

        let zeroXData = {
          Dex: "ZeroX",
          buyAmountZeroX: 0,
          sellAmountZeroX: 0,
        };
        let oneInchData = {
          Dex: "OneInch",
          buyAmountOneInch: 0,
          sellAmountOneInch: 0,
        };
        let paraSwapData = {
          Dex: "Para Swap",
          buyAmountParaSwap: 0,
          sellAmountParaSwap: 0,
        };

        const dataObjects = [
          openOceanData,
          oneInchData,
          zeroXData,
          paraSwapData,
        ];

        const buyResponse = Math.max(
          openOceanData.buyAmountOpenOcean,
          oneInchData.buyAmountOneInch,
          zeroXData.buyAmountZeroX,
          paraSwapData.buyAmountParaSwap
        );
        const sellresponse = Math.max(
          openOceanData.sellAmountOpenOcean,
          oneInchData.sellAmountOneInch,
          zeroXData.sellAmountZeroX,
          paraSwapData.sellAmountParaSwap
        );
        //console.log(buyResponse, sellresponse);

        let bestBuyDex;
        if (Number(buyResponse) === Number(openOceanData.buyAmountOpenOcean)) {
          bestBuyDex = "Open Ocean";
        } else if (
          Number(buyResponse) === Number(oneInchData.buyAmountOneInch)
        ) {
          bestBuyDex = "One Inch";
        } else if (Number(buyResponse) === Number(zeroXData.buyAmountZeroX)) {
          bestBuyDex = "0x";
        } else {
          bestBuyDex = "Para Swap";
        }

        let bestSellDex;
        if (
          Number(sellresponse) === Number(openOceanData.sellAmountOpenOcean)
        ) {
          bestSellDex = "Open Ocean";
        } else if (
          Number(sellresponse) === Number(oneInchData.sellAmountOneInch)
        ) {
          bestSellDex = "One Inch";
        } else if (Number(sellresponse) === Number(zeroXData.sellAmountZeroX)) {
          bestSellDex = "0x";
        } else {
          bestSellDex = "Para Swap";
        }

        let inAmount = parseFloat(amount) + parseFloat(amount * (0.05 / 100));
        let checkProfit = parseFloat(sellresponse) - parseFloat(inAmount);
        const minus_plus =
          checkProfit <= 0 ? -Math.abs(checkProfit) : Math.abs(checkProfit);
        let profitPercent = (minus_plus / amount) * 100;
        //console.log("Profit Percentage:", profitPercent.toFixed(2), "%");

        const result = {
          from_symbols: pair.from,
          to_symbol: pair.to,
          from_dex: bestBuyDex,
          to_dex: bestSellDex,
          buy_price: buyResponse,
          sell_price: sellresponse.toFixed(4),
          Profit_Amount: minus_plus,
          Profit_Percentage: profitPercent.toFixed(3),
          callData: openOceanData.callData,
        };

        if (profitPercent > 0) {
          newArray.push(result);
        }
      })
    );

    return newArray;
  } catch (error) {
    console.error(error);
  }
}

async function generateAIopenOcean(pair, Amount, network) {
  const networkID = network;
  const amount = Amount;

  try {
    const from = pair.from;
    const to = pair.to;
    const from_token_address = pair.from_contract;
    const to_token_address = pair.to_contract;
    const from_token_decimal = pair.from_decimal;
    const to_token_decimal = pair.to_decimal;

    //console.log("From:", from);
    //console.log("To:", to);

    const from_amount = new BigNumber(parseFloat(amount)).toFixed();

    const openocean_config = {
      headers: {
        apikey: "Qdc1YAmzA6ZtzASUoXZQuULntrmP7UvI",
      },
    };

    const openOceanBuyUrl = `https://open-api-pro.openocean.finance/v3/${networkID}/swap_quote?inTokenSymbol=${from}&inTokenAddress=${from_token_address}&outTokenSymbol=${to}&outTokenAddress=${to_token_address}&amount=${from_amount}&slippage=5&gasPrice=200&account=0x8d0A2e65a239c49C5Ca58F6ad38BffE450363b65`;
    const openOceanBuyResponse = await axios.get(
      openOceanBuyUrl,
      openocean_config
    );

    const buyAmount =
      openOceanBuyResponse.data.data.outAmount / 10 ** to_token_decimal;

    if (openOceanBuyResponse && openOceanBuyResponse.data.data.outAmount) {
      const openOceanSellUrl = `https://open-api-pro.openocean.finance/v3/${networkID}/swap_quote?inTokenSymbol=${to}&inTokenAddress=${to_token_address}&outTokenSymbol=${from}&outTokenAddress=${from_token_address}&amount=${buyAmount}&slippage=5&gasPrice=200&account=0x8d0A2e65a239c49C5Ca58F6ad38BffE450363b65`;
      const openOceanSellResponse = await axios.get(
        openOceanSellUrl,
        openocean_config
      );

      if (openOceanSellResponse && openOceanSellResponse.data.data.outAmount) {
        return {
          Dex: "Open Ocean",
          buyAmountOpenOcean: buyAmount,
          sellAmountOpenOcean:
            openOceanSellResponse.data.data.outAmount /
            10 ** from_token_decimal,
          callData: openOceanBuyResponse.data.data.data,
        };
      } else {
        return {
          Dex: "Open Ocean",
          buyAmountOpenOcean: buyAmount,
          sellAmountOpenOcean: 0,
        };
      }
    } else {
      return {
        Dex: "Open Ocean",
        buyAmountOpenOcean: 0,
        sellAmountOpenOcean: 0,
      };
    }
  } catch (error) {
    //console.log(error);
    return {
      Dex: "Open Ocean",
      buyAmountOpenOcean: 0,
      sellAmountOpenOcean: 0,
    };
  }
}

module.exports = { GenerateAIpairs1 };
