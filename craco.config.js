const webpack = require('webpack')
const CracoAntDesignPlugin = require('craco-antd')
const classroomConfig = require('./classroom.config.json')

module.exports = {
  webpack: {
    plugins: [
      new webpack.DefinePlugin({
        websiteTitle: JSON.stringify((classroomConfig.website || {}).title || '排行榜')
      })
    ]
  },
  plugins: [
    {
      plugin: CracoAntDesignPlugin,
      options: {
        // customizeTheme: {
        //   '@primary-color': '#1DA57A',
        // },
      }
    }
  ]
}
