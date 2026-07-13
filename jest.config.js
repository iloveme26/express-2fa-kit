/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/index.ts",
    "!src/types.ts",
  ],
  coverageThreshold: {
    "src/crypto/": {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    "src/methods/": {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
    "src/core/": {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
  },
};
