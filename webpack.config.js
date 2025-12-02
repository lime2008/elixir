const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
module.exports = {
  entry: './src/index.ts',
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  experiments: {
    asyncWebAssembly: true,
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    //library: 'CordovaApp',
    libraryTarget: 'umd',
    globalObject: 'this',
    clean: true,
    pathinfo: false,
  },
      optimization: {
      minimize: true,  // 强制启用压缩，即使在development模式下
      minimizer: [
        // 第一步：Terser 压缩（移除console、精简代码）
        new TerserPlugin({
            extractComments: false,
            terserOptions: {
                keep_fnames: false,
                keep_classnames: false,
                mangle: {
                    // 保留特定变量名不混淆
                    reserved: ['其他需要保留的变量'],
                    // 或者指定要混淆的属性
                    properties: {
                        // 强制混淆所有属性（包括全局变量）
                        reserved: [], // 清空保留列表
                        // 或者指定要保留的属性
                        keep_quoted: true,
                        // 正则表达式匹配要混淆的变量
                        regex: /^(easyFetch|easyWindow|generateHeaders|commonRequestWithPromise|commonRequestWithData)$/,
                    }
                },
                compress: {
                    /*pure_funcs: [
                        'console.log', 
                        'console.info', 
                        'console.warn', 
                        'console.error'
                    ],
                    drop_console: true,*/
                    dead_code: true,
                    unused: true,
                    collapse_vars: true,
                    reduce_vars: true,
                    comparisons: true,
                    booleans: true,
                    loops: true,
                    if_return: true,
                    join_vars: true,
                    side_effects: true,
                    passes: 3,
                     sequences: true,           // 使用逗号操作符连接多个语句
                    conditionals: true,        // 优化if条件和条件表达式
                    evaluate: true,            // 尝试计算常量表达式
                    // 更激进的控制流混淆选项
                    booleans: true,            // 优化布尔表达式
                    loops: true,               // 优化循环
                    unused: true,              // 移除未使用的变量和函数
                    dead_code: true,           // 移除死代码
                    drop_debugger: true,       // 移除debugger语句
                },
            },
        })]},
  devtool: 'source-map'
};