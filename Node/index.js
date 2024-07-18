const express = require("express");
const BP = require("body-parser");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const { GenerateAIpairs1 } = require("./Pair_1");
const { GenerateAIpairs2 } = require("./Pair_2");
const { GenerateAIpairs3 } = require("./Pair_3");
const { GenerateAIpairs4 } = require("./Pair_4");
const { GenerateAIpairs5 } = require("./Pair_5");

const app = express();

app.use(BP.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

const corsOptions = {
  origin: ["http://localhost", "*"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

const fromTokens = JSON.parse(fs.readFileSync("FromPolygon.json", "utf8"));

app.post("/fetchData", async (req, res) => {
  const { token, amount } = req.body;
  console.log(req.body)

  try {
    const selectedOption = fromTokens.find((t) => t.symbol === token);

    if (!selectedOption) {
      return res.status(400).send("Invalid token provided");
    }

    const pricedata = await axios.get(
      `https://min-api.cryptocompare.com/data/price?api_key=2aeee6fbe025c5317ce4c9e7bd537ab2d245e31c288838e55580dc88d7ba8fb2&fsym=${token}&tsyms=USD`
    );

    const amountInUSD = amount / pricedata.data.USD;

    const data = {
      address: selectedOption.address,
      symbol: selectedOption.symbol,
      decimals: selectedOption.decimals,
      amount: amountInUSD.toFixed(5),
      Network: 'Polygon',
      EnterAmount: amount,
    };

    const functionsToCall = [
      GenerateAIpairs1,
      GenerateAIpairs2,
      GenerateAIpairs3,
      GenerateAIpairs4,
      GenerateAIpairs5,
    ];

    const responses = await Promise.all(
      functionsToCall.map((func) => func(data))
    );

    const storePairs = responses.flat();
    console.log("All responses:", storePairs.length);
    res.send(storePairs);

  } catch (error) {
    console.log("Error while fetching: ", error);
    res.status(500).send("Error while fetching data");
  }
});

app.listen(3006, (err) => {
  if (err) throw err;
  console.log("Port running on 3006");
});
