/** Minimal ABIs — only include functions we actually call */

export const POSITION_MANAGER_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce",                        type: "uint96"  },
      { name: "operator",                     type: "address" },
      { name: "token0",                       type: "address" },
      { name: "token1",                       type: "address" },
      { name: "fee",                          type: "uint24"  },
      { name: "tickLower",                    type: "int24"   },
      { name: "tickUpper",                    type: "int24"   },
      { name: "liquidity",                    type: "uint128" },
      { name: "feeGrowthInside0LastX128",     type: "uint256" },
      { name: "feeGrowthInside1LastX128",     type: "uint256" },
      { name: "tokensOwed0",                  type: "uint128" },
      { name: "tokensOwed1",                  type: "uint128" },
    ],
  },
] as const;

export const FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee",    type: "uint24"  },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

export const POOL_ABI = [
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96",              type: "uint160" },
      { name: "tick",                      type: "int24"   },
      { name: "observationIndex",          type: "uint16"  },
      { name: "observationCardinality",    type: "uint16"  },
      { name: "observationCardinalityNext",type: "uint16"  },
      { name: "feeProtocol",               type: "uint8"   },
      { name: "unlocked",                  type: "bool"    },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
