'use strict'

require('colors')
const path = require('path')
const constants = require('./constants')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

const args = process.argv.slice(2)
const REQUIRED_FIELDS_COUNT = 2
const EPOCH_VOTING_SECONDS = 180 * 1000

if (args.length < REQUIRED_FIELDS_COUNT) {
  console.log(
    'Arguments required: exchange, pair, datafile, seconds from start of epoch.'.red,
    'E.g.\n node index.js binance BTCUSDC btc.json 10\n'.cyan,
    'node index.js coingecko-latest bitcoin'.cyan,
  )
  process.exit(0)
}

const [exchange, pair, file = undefined, seconds = 0] = args
const {data = []} = require(path.join(__dirname, file ?? '.temp'))

const epoch = data.slice(0, 5).map((d) => ({
  epoch: d.epochId,
  time: d.endTime - EPOCH_VOTING_SECONDS + +seconds * 1000,
  end: d.endTime,
  high: d.highRewardedPrice,
  low: d.lowRewardedPrice,
}))
if(epoch.length) {
  console.log('data from file')
  console.table(epoch)
}

async function call(url) {
  const res = await fetch(url)
  return res.json()
}

async function fetchExchangeData() {
  let body = null
  switch (exchange) {
    case 'ascendex':
      body = await call(`${constants.ascendex}&symbol=${pair}&to=${epoch[0].time * 1000}`)
      return body?.data?.map((b) => ({time: Math.floor(b.data.ts / 1000), open: b.data.o, close: b.data.c})).reverse()
    case 'binance':
      body = await call(
        `${constants.binance}&symbol=${pair}&endTime=${epoch[0].time * 1000}&startTime=${epoch[epoch.length - 1].time * 1000}`,
      )
      return body?.map((b) => ({start: b[0] / 1000, end: Math.floor(b[6] / 1000), open: b[1], close: b[4]})).reverse()
    case 'coingecko-latest':
      body = await call(`${constants.coingeckolatest}/${pair}/tickers`)
      body = body.tickers
        .filter((b) => b.target.includes('USD'))
        .map((d) => d.last)
        .sort()
      const mid = Math.floor(body.length / 2)
      return body.length % 2 === 0 ? (body[mid - 1] + body[mid]) / 2 : body[mid]
    default:
      console.error(`${exchange} not supported yet`.red)
      return null
  }
}

async function main() {
  try {
    const data = await fetchExchangeData()
    if (!data) {
      console.error(`Failed to fetch data from ${exchange}`.red)
      return
    }
    console.log(`data from ${exchange}`)
    console.table(data)
  } catch(err) {
    console.error(err)
  }
}

main()
