// const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
// const { join, resolve } = require("path");

// module.exports = {
//   output: {
//     path: join(__dirname, 'dist'),
//     // clean: true,
//     // ...(process.env.NODE_ENV !== 'production' && {
//     //   devtoolModuleFilenameTemplate: '[absolute-resource-path]',
//     // }),
//   },
//   resolve :{
//     alias: {
//       "@packages": resolve(__dirname, "../../packages"),
//     },
//     extensions: [".ts", ".js"],
//   },
//   plugins: [
//     new NxAppWebpackPlugin({
//       target: 'node',
//       compiler: 'tsc',
//       main: './src/main.ts',
//       tsConfig: './tsconfig.app.json',
//       optimization: false,
//       outputHashing: 'none',
//       generatePackageJson: true,
//     }),
//   ],
// };


const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join, resolve } = require("path");

module.exports = {
  output: {
    path: join(__dirname, "dist"),
  },

  resolve: {
    alias: {
      "@packages": resolve(__dirname, "../../packages"),
    },
    extensions: [".ts", ".js"],
  },

  externals: [
  ({ request }, callback) => {
    // Do not bundle Prisma at all
    if (
      request?.startsWith("@prisma/client") ||
      request?.includes("generated/prisma")
    ) {
      return callback(null, "commonjs " + request);
    }
    callback();
  },
],


  plugins: [
    new NxAppWebpackPlugin({
      target: "node",
      compiler: "tsc",
      main: "./src/main.ts",
      tsConfig: "./tsconfig.app.json",
      optimization: false,
      outputHashing: "none",
      generatePackageJson: true,
    }),
  ],
};
