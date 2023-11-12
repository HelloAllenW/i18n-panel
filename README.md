## 调试
1. npm run dev 启动插件服务，然后F5后会启动VSCode的Extenstion Development Host；
2. 鼠标右键->打开翻译工作台，即进入了插件工作台；
3. 控制台再执行npm run workbench:build，会启动editor/App.vue的热更新服务；
4. 修改代码后在Extenstion Development Host使用快捷键ctal+R进行刷新；

## 使用说明
1. 第一次使用插件，如果国际化目录能够自动识别出来则不需要重新配置。否则显示并运行命令->手动设置语言目录
2. 第一次使用替换当前文档时，需要设置系统中的国际化调用函数名称。显示并运行命令->设置系统中的国际化调用函数名称->i18n.t


## ❤️ Thanks
- [@yzydeveloper](https://zhuanlan.zhihu.com/p/481449781?utm_id=0)
- [VSCode 插件开发流程](https://zhuanlan.zhihu.com/p/71693080)
- [官方文檔](https://code.visualstudio.com/api)
