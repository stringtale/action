

const customJestConfig = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  testRegex: [
    "\\.server\\.(test)\\.(j|t)sx?$",
    ".*\\.(test)\\.(j|t)sx?$",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
  ],
  transformIgnorePatterns: ["<rootDir>/node_modules/(?!(@actions)/)"],
}


module.exports = customJestConfig
